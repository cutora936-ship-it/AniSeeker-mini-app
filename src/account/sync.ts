import { accountKeys, avatarIdPattern, normalizeValue } from '../../shared/account-keys.mjs';
import { cacheAvatar, readAvatar, readProfile } from '../profile/storage';
import { createUserStorage, type UserScope, type UserStorage } from './storage';

export const cloudEnabled = Boolean(import.meta.env.VITE_SUPABASE_URL && import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY);

type Change = { key: string; value: string; version: number; mutation: string };
type Entry = Omit<Change, 'mutation'> & { mutation: string | null };
type LocalEntry = Entry & { pending?: string; sending?: Change };
type Mirror = { entries: Record<string, LocalEntry>; imported?: boolean };
type Login = { token: string; user: string; entries: Entry[] };
type Save = { entries: Entry[] };

class RequestError extends Error {
  constructor(readonly status: number) { super(`Account request failed (${status})`); }
}

function readMirror(key: string): Mirror {
  try {
    const data = JSON.parse(localStorage.getItem(key) ?? 'null');
    return data?.entries && typeof data.entries === 'object' ? data : { entries: {} };
  } catch {
    return { entries: {} };
  }
}

function legacyValue(storage: UserStorage, key: string) {
  try { return storage.getItem(key); } catch { return null; }
}

export function createCloudAccount(scope: Exclude<UserScope, 'guest'>, initData: string) {
  const mirrorKey = `aniseeker:user:${scope}:cloud:v1`;
  const legacy = createUserStorage(scope);
  const mirror = readMirror(mirrorKey);
  let token = '';
  let confirmedAvatar: string | null = null;
  let blocked = false;
  let halted = false;
  let verified = false;
  let ready = false;
  let active = false;
  let running = false;
  let retry = 2000;
  let timer: number | undefined;
  let authorized = false;
  let controller = new AbortController();
  const temporary: Record<string, string> = {};
  let visibleState = { ready, authorized, canImport: false, rejected: blocked };
  const dataListeners = new Map<string, Set<() => void>>();
  const listeners = new Set<() => void>();

  function emit() {
    const canImport = authorized && !mirror.imported && [...accountKeys.keys()].some(key =>
      !mirror.entries[key] && legacyValue(legacy, key) !== null);
    if (ready === visibleState.ready && authorized === visibleState.authorized && canImport === visibleState.canImport && blocked === visibleState.rejected) return;
    visibleState = { ready, authorized, canImport, rejected: blocked };
    listeners.forEach(listener => listener());
  }

  function persist() {
    try { localStorage.setItem(mirrorKey, JSON.stringify(mirror)); } catch { /* The current session can still play. */ }
  }

  function preserveConflict(entry: LocalEntry) {
    try {
      // Keep a bounded recovery copy of the latest conflicting write per key and account.
      localStorage.setItem(`${mirrorKey}:conflict:${entry.key}`, JSON.stringify(entry));
    } catch { /* The last confirmed cloud value is still available. */ }
  }

  async function request(action: string, body?: object, timeout = 6000) {
    const account = controller.signal;
    const request = new AbortController();
    const cancel = () => request.abort();
    account.throwIfAborted();
    account.addEventListener('abort', cancel, { once: true });
    const deadline = window.setTimeout(cancel, timeout);
    try {
      const payload = body && JSON.stringify(body);
      const response = await fetch(`/api/account?action=${action}`, {
        method: body ? 'POST' : 'GET',
        headers: {
          ...(body && { 'Content-Type': 'application/json' }),
          ...(token && { Authorization: `Bearer ${token}` }),
        },
        body: payload,
        keepalive: action === 'save' && Boolean(payload && new TextEncoder().encode(payload).length < 48000),
        credentials: 'omit',
        cache: 'no-store',
        signal: request.signal,
      });
      if (!response.ok) throw new RequestError(response.status);
      const value = response.status === 204 ? null : action.startsWith('avatar&') && !body
        ? await response.blob() : await response.json();
      account.throwIfAborted();
      return value;
    } finally {
      window.clearTimeout(deadline);
      account.removeEventListener('abort', cancel);
    }
  }

  function apply(entry: Entry) {
    const old = mirror.entries[entry.key];
    const value = entry.key === 'profile:v1' ? normalizeValue(entry.key, entry.value) ?? entry.value : entry.value;
    mirror.entries[entry.key] = { ...entry, value };
    if (old?.value !== value) dataListeners.get(entry.key)?.forEach(listener => listener());
  }

  function setAvatar(entry: Entry) {
    if (entry.key === 'profile:v1') confirmedAvatar = JSON.parse(entry.value).avatarId;
  }

  async function connect() {
    const login: Login = await request('login', { initData }, 3500);
    if (`telegram:${login.user}` !== scope) throw new RequestError(401);
    token = login.token;
    authorized = verified = true;
    for (const entry of login.entries) {
      if (!accountKeys.has(entry.key)) continue;
      setAvatar(entry);
      const local = mirror.entries[entry.key];
      if (!local?.pending) apply(entry);
    }
    persist();
  }

  function schedule(delay = 5000) {
    if (!active || halted || timer !== undefined) return;
    timer = window.setTimeout(() => { timer = undefined; void flush(); }, delay);
  }

  async function send(changes: Change[]) {
    const result: Save = await request('save', { changes });
    for (const entry of result.entries) {
      const sent = changes.find(change => change.key === entry.key);
      const local = mirror.entries[entry.key];
      if (!sent || !local || local.sending?.mutation !== sent.mutation) continue;
      setAvatar(entry);
      if (sent.mutation === entry.mutation && local.pending !== sent.mutation) {
        mirror.entries[entry.key] = { ...local, version: entry.version, mutation: entry.mutation, sending: undefined };
      } else {
        if (sent.mutation !== entry.mutation) preserveConflict(local);
        apply(entry);
      }
    }
    persist();
  }

  function outgoing(entry: LocalEntry): Change {
    return entry.sending ?? { key: entry.key, value: entry.value, version: entry.version, mutation: entry.pending! };
  }

  async function sendProfile(entry: LocalEntry) {
    const signal = controller.signal;
    const change = outgoing(entry);
    const avatar = JSON.parse(change.value).avatarId;
    if (avatarIdPattern.test(avatar) && avatar !== confirmedAvatar) {
      const photo = await readAvatar(scope, avatar);
      if (photo) {
        const data = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(String(reader.result).split(',')[1]);
          reader.onerror = () => reject(reader.error);
          reader.readAsDataURL(photo);
        });
        signal.throwIfAborted();
        try {
          await request(`avatar&id=${avatar}`, { data }, 12000);
        } catch (error) {
          // A retired avatar can accompany a stale write. Let SQL resolve the revision before checking the photo.
          if (!(error instanceof RequestError) || error.status !== 409) throw error;
        }
      }
    }
    signal.throwIfAborted();
    try {
      await send([change]);
    } catch (error) {
      if (!(error instanceof RequestError) || error.status !== 409) throw error;
      const current = mirror.entries[change.key];
      preserveConflict(current);
      if (current.pending !== change.mutation) current.sending = undefined;
      else {
        delete mirror.entries[change.key];
        dataListeners.get(change.key)?.forEach(listener => listener());
        token = '';
      }
      persist();
    }
  }

  async function flush() {
    if (!active || running || halted || !navigator.onLine) {
      if (!ready && active && !navigator.onLine) { ready = true; emit(); }
      return;
    }
    running = true;
    const signal = controller.signal;
    try {
      if (!token) await connect();
      if (signal.aborted) return;
      ready = true;
      emit();
      const entries = Object.values(mirror.entries).filter(entry => entry.pending);
      const data = entries.filter(entry => entry.key !== 'profile:v1');
      // Leave a failed avatar upload independent of game and settings changes.
      if (data.length) {
        const batch = data.slice(0, 4).map(outgoing);
        for (const change of batch) mirror.entries[change.key].sending = change;
        persist();
        await send(batch);
      }
      const profile = mirror.entries['profile:v1'];
      if (profile?.pending) {
        profile.sending = outgoing(profile);
        persist();
        await sendProfile(profile);
        if (!token) schedule(0);
      }
      retry = 2000;
      if (Object.values(mirror.entries).some(entry => entry.pending)) schedule();
    } catch (error) {
      if (signal.aborted) return;
      if (error instanceof RequestError && error.status === 401) {
        if (token) { authorized = false; token = ''; schedule(0); }
        else { halted = true; blocked = !verified; authorized = false; }
      } else {
        schedule(retry);
        retry = Math.min(retry * 2, 60000);
      }
    } finally {
      if (!signal.aborted) {
        running = false;
        ready = true;
        emit();
      }
    }
  }

  const storage: UserStorage = {
    getItem(key) {
      const name = key.replace(/^aniseeker:/, '');
      return (blocked ? temporary[name] : mirror.entries[name]?.value) ?? null;
    },
    setItem(name, value) {
      const key = name.replace(/^aniseeker:/, '');
      const existing = mirror.entries[key];
      if (!accountKeys.has(key)) return;
      if (blocked) { temporary[key] = value; return; }
      if (existing?.value === value && (existing.pending || existing.version > 0)) return;
      mirror.entries[key] = {
        key, value, version: existing?.version ?? 0, mutation: existing?.mutation ?? null,
        pending: crypto.randomUUID(), sending: existing?.sending,
      };
      persist();
      schedule(key === 'profile:v1' || key === 'favorites:v1' ? 300 : undefined);
    },
  };

  function flushOnHide() {
    if (token) void flush();
  }

  function wake() {
    if (timer !== undefined) window.clearTimeout(timer);
    timer = undefined;
    schedule(0);
  }

  return {
    storage,
    snapshot: () => visibleState,
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => { listeners.delete(listener); };
    },
    subscribeData(key: string, listener: () => void) {
      const subscribers = dataListeners.get(key) ?? new Set();
      dataListeners.set(key, subscribers);
      subscribers.add(listener);
      return () => { subscribers.delete(listener); };
    },
    start() {
      // The same object can be mounted again by React StrictMode.
      controller = new AbortController();
      active = true;
      window.addEventListener('online', wake);
      window.addEventListener('focus', wake);
      window.addEventListener('pagehide', flushOnHide);
      const onVisible = () => { if (document.hidden) flushOnHide(); else wake(); };
      document.addEventListener('visibilitychange', onVisible);
      wake();
      return () => {
        active = running = false;
        controller.abort();
        if (timer !== undefined) window.clearTimeout(timer);
        timer = undefined;
        window.removeEventListener('online', wake);
        window.removeEventListener('focus', wake);
        window.removeEventListener('pagehide', flushOnHide);
        document.removeEventListener('visibilitychange', onVisible);
      };
    },
    async loadAvatar(id: string) {
      if (blocked) return null;
      const local = await readAvatar(scope, id).catch(() => null);
      if (local || !token || !avatarIdPattern.test(id)) return local;
      const blob: Blob = await request(`avatar&id=${id}`);
      if (!active) return null;
      await cacheAvatar(scope, id, blob).catch(() => {});
      return blob;
    },
    async importLegacy() {
      if (!authorized || mirror.imported) return;
      const profile = readProfile(legacy);
      const avatar = profile.avatarId && avatarIdPattern.test(profile.avatarId)
        ? profile.avatarId : null;
      const photo = avatar ? await readAvatar(scope, avatar).catch(() => null) : null;
      if (!active || !authorized || mirror.imported) return;
      for (const key of accountKeys.keys()) {
        if (mirror.entries[key]) continue;
        const value = legacyValue(legacy, key);
        if (value === null) continue;
        if (key === 'profile:v1') {
          if (profile.nickname || photo) storage.setItem(key, JSON.stringify({ nickname: profile.nickname || 'Гость', avatarId: photo ? avatar : null }));
        } else {
          const checked = normalizeValue(key, value);
          if (checked !== null) storage.setItem(key, checked);
        }
        dataListeners.get(key)?.forEach(listener => listener());
      }
      mirror.imported = true;
      persist();
      emit();
    },
  };
}

export type CloudAccount = ReturnType<typeof createCloudAccount>;
