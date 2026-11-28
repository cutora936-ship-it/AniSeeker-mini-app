import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createUserStorage, telegramScope } from '../src/account/storage.ts';

test('Telegram identity accepts a positive safe integer, independently of the Telegram nickname', () => {
  assert.equal(telegramScope(4_580_952_956), 'telegram:4580952956');
  for (const invalid of [undefined, null, 0, -1, '123', 1.5, Infinity, 2 ** 53]) {
    assert.equal(telegramScope(invalid), null);
  }
});

test('account stores remain bound to their original scope and never fall back to legacy keys', (t) => {
  const entries = new Map();
  const key = 'aniseeker:profile:v1';
  entries.set(key, 'legacy');
  globalThis.localStorage = {
    getItem: (name) => entries.get(name) ?? null,
    setItem: (name, value) => entries.set(name, value),
  };
  t.after(() => { delete globalThis.localStorage; });

  const first = createUserStorage('telegram:4580952956');
  const second = createUserStorage('telegram:100');
  const guest = createUserStorage('guest');
  for (const storage of [first, second, guest]) assert.equal(storage.getItem(key), null);

  first.setItem(key, 'first');
  second.setItem(key, 'second');
  guest.setItem(key, 'guest');
  // An asynchronous save by the original account retains its original scope.
  first.setItem(key, 'updated');
  assert.equal(createUserStorage('telegram:4580952956').getItem(key), 'updated');
  assert.equal(second.getItem(key), 'second');
  assert.equal(guest.getItem(key), 'guest');
  assert.equal(entries.get(key), 'legacy');
});
