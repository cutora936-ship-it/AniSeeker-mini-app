import { createClient } from '@supabase/supabase-js';
import { parseChanges } from '../server/state.mjs';
import { avatarIdPattern } from '../shared/account-keys.mjs';
import { issueSession, verifySession, verifyTelegram } from '../server/telegram.mjs';

const bucket = 'aniseeker-avatars';
const profileTable = 'aniseeker_profiles';
const avatarTable = 'aniseeker_avatars';
let supabase;

function avatarPath(user, avatar) {
  return `${user}/${avatar}.webp`;
}

function objectBody(req) {
  if (!req.headers['content-type']?.startsWith('application/json')) return null;
  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
    return body && typeof body === 'object' && !Array.isArray(body) ? body : null;
  } catch {
    return null;
  }
}

function fail(res, status) {
  return res.status(status).json({ error: status });
}

export function createAccountHandler(getDatabase, config) {
  return async function handler(req, res) {
    res.setHeader('Cache-Control', 'private, no-store');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    const { botToken, sessionSecret } = config();
    if (!botToken || !sessionSecret || sessionSecret.length < 32) return fail(res, 503);

    const limited = Number(req.headers['content-length']);
    if (limited > 4 * 1024 * 1024) return fail(res, 413);
    const route = new URL(req.url, 'https://aniseeker.invalid').searchParams;
    const action = route.get('action');
    const body = req.method === 'POST' ? objectBody(req) : null;

    try {
      if (action === 'login' && req.method === 'POST') {
        const user = verifyTelegram(body?.initData, botToken);
        if (!user) return fail(res, 401);
        const db = getDatabase();
        const { error } = await db.from(profileTable)
          .upsert({ telegram_id: user }, { onConflict: 'telegram_id', ignoreDuplicates: true });
        if (error) return fail(res, 503);
        const { data, error: readError } = await db.rpc('aniseeker_read_account', { p_user: user });
        if (readError || !data) return fail(res, 503);
        return res.status(200).json({ ...data, user, token: issueSession(user, sessionSecret) });
      }

      // Every query and object path below uses only the verified session identity.
      const user = verifySession(req.headers.authorization, sessionSecret);
      if (!user) return fail(res, 401);

      if (action === 'save' && req.method === 'POST') {
        const changes = parseChanges(body?.changes);
        if (!changes) return fail(res, 400);
        const db = getDatabase();
        const { data, error } = await db.rpc('aniseeker_save_account', { p_user: user, p_changes: changes });
        if (error) return fail(res, error.code === '22023' ? 409 : 503);
        const retired = data.filter(entry => entry.retired).map(entry => avatarPath(user, entry.retired));
        if (retired.length) await db.storage.from(bucket).remove(retired).catch(() => {});
        return res.status(200).json({ entries: data });
      }

      if (action === 'avatar') {
        const avatar = route.get('id');
        if (!avatar || !avatarIdPattern.test(avatar)) return fail(res, 400);
        const db = getDatabase();
        const objects = db.storage.from(bucket);
        const path = avatarPath(user, avatar);
        if (req.method === 'GET') {
          const { data: profile, error } = await db.from(profileTable).select('avatar_id')
            .eq('telegram_id', user).maybeSingle();
          if (error) return fail(res, 503);
          if (profile?.avatar_id !== avatar) return fail(res, 404);
          const { data, error: downloadError } = await objects.download(path);
          if (downloadError) return fail(res, 503);
          res.setHeader('Content-Type', 'image/webp');
          return res.status(200).send(Buffer.from(await data.arrayBuffer()));
        }
        if (req.method === 'POST') {
          const { data: existing, error: readError } = await db.from(avatarTable).select('retired_at')
            .eq('telegram_id', user).eq('avatar_id', avatar).maybeSingle();
          if (readError) return fail(res, 503);
          if (existing) return existing.retired_at ? fail(res, 409) : res.status(204).end();

          const { normalizeImage } = await import('../server/avatar.mjs');
          const image = await normalizeImage(body?.data);
          if (!image) return fail(res, 400);
          const { error: uploadError } = await objects.upload(path, image, { contentType: 'image/webp', upsert: false });
          if (uploadError && !['409', 'Duplicate', 'ResourceAlreadyExists'].some(code =>
            code === String(uploadError.statusCode) || code === uploadError.code)) return fail(res, 503);
          const { error: insertError } = await db.from(avatarTable).upsert(
            { telegram_id: user, avatar_id: avatar }, { onConflict: 'telegram_id,avatar_id', ignoreDuplicates: true },
          );
          return insertError ? fail(res, 503) : res.status(204).end();
        }
      }

      return fail(res, 404);
    } catch {
      // Do not log initData, sessions, data, or credentials.
      return fail(res, 503);
    }
  };
}

export default createAccountHandler(() => {
  if (!supabase) {
    const url = process.env.VITE_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) throw new Error('Supabase needs server configuration');
    supabase = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } });
  }
  return supabase;
}, () => ({ botToken: process.env.TELEGRAM_BOT_TOKEN, sessionSecret: process.env.ANISEEKER_SESSION_SECRET }));
