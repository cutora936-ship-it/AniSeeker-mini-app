import { createHmac, timingSafeEqual } from 'node:crypto';

const maxLaunchAge = 3600;
const sessionLifetime = 12 * 3600;

function hmac(key, message) {
  return createHmac('sha256', key).update(message).digest();
}

function equals(left, right) {
  return left.length === right.length && timingSafeEqual(left, right);
}

export function verifyTelegram(initData, botToken, now = Math.floor(Date.now() / 1000)) {
  if (typeof initData !== 'string' || !initData || initData.length > 16384) return null;
  const fields = new URLSearchParams(initData);
  if (new Set(fields.keys()).size !== fields.size) return null;
  const hash = fields.get('hash');
  if (!hash || !/^[0-9a-f]{64}$/.test(hash)) return null;
  fields.delete('hash');

  const check = [...fields].sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0)
    .map(([name, value]) => `${name}=${value}`).join('\n');
  if (!equals(Buffer.from(hash, 'hex'), hmac(hmac('WebAppData', botToken), check))) return null;

  const authDate = fields.get('auth_date');
  if (!authDate || !/^\d{1,12}$/.test(authDate)) return null;
  const age = now - Number(authDate);
  if (age > maxLaunchAge || age < -30) return null;
  try {
    const id = JSON.parse(fields.get('user'))?.id;
    return Number.isSafeInteger(id) && id > 0 ? String(id) : null;
  } catch {
    return null;
  }
}

export function issueSession(id, secret, now = Math.floor(Date.now() / 1000)) {
  const message = `v1.${id}.${now + sessionLifetime}`;
  return `${message}.${hmac(secret, message).toString('base64url')}`;
}

export function verifySession(header, secret, now = Math.floor(Date.now() / 1000)) {
  const parts = typeof header === 'string' && /^Bearer (v1\.(\d{1,16})\.(\d{1,12}))\.([A-Za-z0-9_-]{43})$/.exec(header);
  if (!parts || Number(parts[3]) <= now || !equals(hmac(secret, parts[1]), Buffer.from(parts[4], 'base64url'))) return null;
  return parts[2];
}
