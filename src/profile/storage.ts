import type { UserScope, UserStorage } from '../account/storage';

const storageKey = 'aniseeker:profile:v1';
const databaseName = 'aniseeker-profile';
const avatarStore = 'avatars';

export interface ProfilePreferences {
  nickname: string;
  avatarId: string | null;
}

export function nicknameLength(value: string) {
  return [...value.trim().normalize('NFC')].length;
}

export function validateNickname(value: string) {
  const length = nicknameLength(value);
  if (length < 2) return 'Введи никнейм из 2–24 символов.';
  if (length > 24) return 'Сократи никнейм до 24 символов.';
  return '';
}

export function readProfile(storage: UserStorage): ProfilePreferences {
  try {
    const preferences = JSON.parse(storage.getItem(storageKey) ?? 'null');
    return {
      nickname: typeof preferences?.nickname === 'string' && !validateNickname(preferences.nickname)
        ? preferences.nickname : '',
      avatarId: typeof preferences?.avatarId === 'string' ? preferences.avatarId : null,
    };
  } catch {
    return { nickname: '', avatarId: null };
  }
}

async function withAvatars<T>(
  mode: IDBTransactionMode,
  operation: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  const database = await new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(databaseName, 1);
    request.onupgradeneeded = () => request.result.createObjectStore(avatarStore);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });

  try {
    return await new Promise<T>((resolve, reject) => {
      const transaction = database.transaction(avatarStore, mode);
      const request = operation(transaction.objectStore(avatarStore));
      transaction.oncomplete = () => resolve(request.result);
      transaction.onabort = () => reject(transaction.error ?? request.error);
    });
  } finally {
    database.close();
  }
}

export async function readAvatar(scope: UserScope, id: string) {
  const value: unknown = await withAvatars('readonly', (store) => store.get([scope, id]));
  if (!value || typeof value !== 'object') return null;
  const { bytes, type } = value as { bytes?: unknown; type?: unknown };
  return bytes instanceof ArrayBuffer && typeof type === 'string' ? new Blob([bytes], { type }) : null;
}

function deleteAvatar(scope: UserScope, id: string) {
  return withAvatars('readwrite', (store) => store.delete([scope, id]));
}

export async function saveProfile(scope: UserScope, storage: UserStorage, nickname: string, avatarChange: Blob | null | undefined) {
  const name = nickname.trim().normalize('NFC');
  if (validateNickname(name)) throw new Error('Invalid nickname');

  // Write a new image before switching the localStorage reference to it.
  const newId = avatarChange instanceof Blob
    ? [...crypto.getRandomValues(new Uint8Array(16))].map((byte) => byte.toString(16).padStart(2, '0')).join('')
    : null;
  if (newId && avatarChange) {
    // Some WebKit environments cannot persist Blob objects in IndexedDB.
    const image = { bytes: await avatarChange.arrayBuffer(), type: avatarChange.type };
    await withAvatars('readwrite', (store) => store.add(image, [scope, newId]));
  }

  const previous = readProfile(storage);
  const avatarId = avatarChange === undefined ? previous.avatarId : newId;
  const preferences = { nickname: name, avatarId };

  try {
    storage.setItem(storageKey, JSON.stringify(preferences));
  } catch (error) {
    if (newId) await deleteAvatar(scope, newId).catch(() => {});
    throw error;
  }

  if (previous.avatarId && previous.avatarId !== avatarId) {
    await deleteAvatar(scope, previous.avatarId).catch(() => {});
  }
  return preferences;
}
