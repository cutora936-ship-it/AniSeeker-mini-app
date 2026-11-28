import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { test } from 'node:test';
import sharp from 'sharp';
import { createAccountHandler } from '../api/account.mjs';
import { normalizeImage } from '../server/avatar.mjs';
import { parseChanges } from '../server/state.mjs';
import { issueSession, verifySession, verifyTelegram } from '../server/telegram.mjs';

const botToken = 'fixture-only-bot-token';
const sessionSecret = 'fixture-only-session-secret-32-characters';
const now = 1770000000;

function signedLaunch(id, time = now) {
  const fields = new URLSearchParams({ user: JSON.stringify({ id, first_name: 'Тест + имя' }), auth_date: String(time), query_id: 'fixture/+', signature: 'fixture_signature' });
  fields.sort();
  const text = [...fields].map(([key, value]) => `${key}=${value}`).join('\n');
  const key = createHmac('sha256', 'WebAppData').update(botToken).digest();
  fields.set('hash', createHmac('sha256', key).update(text).digest('hex'));
  return fields.toString();
}

test('accepts signed Telegram identity and rejects invalid launch arguments', () => {
  assert.equal(verifyTelegram(signedLaunch(4580952956), botToken, now), '4580952956');
  assert.equal(verifyTelegram(signedLaunch(71, now - 3601), botToken, now), null);
  assert.equal(verifyTelegram(signedLaunch(71, now + 31), botToken, now), null);
  assert.equal(verifyTelegram(signedLaunch(-1), botToken, now), null);
  assert.equal(verifyTelegram(signedLaunch(71) + '&auth_date=' + now, botToken, now), null);
  assert.equal(verifyTelegram(signedLaunch(71).replace('71','81'), botToken, now), null);
  assert.equal(verifyTelegram(signedLaunch(71), 'another bot', now), null);
});

test('sessions bind identity and expiration to the signature', () => {
  const token = issueSession('47', sessionSecret, now);
  assert.equal(verifySession('Bearer ' + token, sessionSecret, now+60), '47');
  assert.equal(verifySession('Bearer ' + token, sessionSecret, now+43200), null);
  assert.equal(verifySession('Bearer ' + token.replace('.47.', '.48.'), sessionSecret, now), null);
  assert.equal(verifySession('Bearer ' + token, 'different secret', now), null);
});

test('game slots are allowlisted and validated', () => {
  const change = { key: 'training:match:v1', value: 'null', version: 1, mutation: '432d2c18-64dc-4657-88c1-9746a36e13df' };
  assert.equal(parseChanges([change])[0].group, 'training');
  assert.equal(parseChanges([change, change]), null);
  assert.equal(parseChanges([{ ...change, key: 'telegram:25:training:match:v1' }]), null);
  assert.equal(parseChanges([{ ...change, key: 'favorites:v1', value: '{}' }]), null);
  assert.equal(parseChanges([{ ...change, key: 'profile:v1', value: '{"nickname":"Лайт","avatarId":"../other"}' }]), null);
  assert.equal(parseChanges([{ ...change, key: 'profile:v1', value: '{"nickname":"Лайт","avatarId":null}' }])[0].group, 'profile');
});

test('avatar images are decoded, resized and converted, with invalid bytes and formats rejected', async () => {
  const raw = sharp({ create: { width: 768, height: 256, channels: 3, background: 'purple' } });
  const converted = await normalizeImage((await raw.png().toBuffer()).toString('base64'));
  const { format, width, height } = await sharp(converted).metadata();
  assert.deepEqual({ format, width, height }, { format: 'webp', width: 512, height: 171 });
  assert.equal(await normalizeImage(Buffer.from('<svg/>').toString('base64')), null);
  assert.equal(await normalizeImage(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]).toString('base64')), null);
  assert.equal(await normalizeImage('x'.repeat(2 * 1024 * 1024)), null);
});

test('API uses signed identities for reads, writes and current avatar paths', async () => {
  const scopes = [];
  const selection = [];
  const photoId = 'ad4957ef28404c77802fa8759bd6c822';
  const db = {
    rpc(name, parameters) {
      scopes.push([name, parameters.p_user]);
      return { data: name === 'aniseeker_read_account' ? { entries: [], registeredAt: 'date' } : [] };
    },
    from() {
      return {
        upsert({telegram_id}) { scopes.push(['upsert', telegram_id]); return {}; },
        select() { return this; },
        eq(column, value) { selection.push([column, value]); return this; },
        maybeSingle() { return { data: { avatar_id: selection.at(-1)[1] === '47' ? photoId : null } }; },
      };
    },
    storage: { from() {
      return { download(path) { return { data: new Blob([path]) }; } };
    } },
  };
  const handler = createAccountHandler(() => db, () => ({ botToken, sessionSecret }));
  async function call(url, method, body, signedToken) {
    const result = {};
    const headers = { 'content-type': 'application/json', authorization: signedToken && 'Bearer ' + signedToken };
    const response = { setHeader() {}, status(code) { result.code = code; return this; },
      json(value) { result.body = value; }, send(value) { result.body = value; } };
    await handler({ url, method, body, headers }, response);
    return result;
  }
  const fresh = Math.floor(Date.now()/1000);
  const { code, body } = await call('/api/account?action=login', 'POST', { initData: signedLaunch(47, fresh), user: '48' });
  assert.equal(code, 200);
  assert.equal(body.user, '47');
  assert.deepEqual(scopes, [['upsert', '47'], ['aniseeker_read_account', '47']]);
  const changes = [{ key: 'favorites:v1', value: '[]', version: 0, mutation: '432d2c18-64dc-4657-88c1-9746a36e13df' }];
  assert.equal((await call('/api/account?action=save', 'POST', { changes, user: '48' })).code, 401);
  assert.equal((await call('/api/account?action=save&user=48', 'POST', { changes, user: '48' }, body.token)).code, 200);
  assert.deepEqual(scopes.at(-1), ['aniseeker_save_account', '47']);
  const path = '/api/account?action=avatar&user=47&id=' + photoId;
  assert.equal((await call(path, 'GET', null, issueSession('48', sessionSecret))).code, 404);
  assert.equal((await call(path, 'GET', null, body.token)).body.toString(), '47/' + photoId + '.webp');
});
