import assert from 'node:assert/strict';
import { test } from 'node:test';
import { makeRound, roundsPerGame, symbolNames } from '../src/match/round.ts';
import { displayTime, isRecord, readRecords, saveResult } from '../src/match/records.ts';

test('20,000 pairs have exactly one matching symbol and separate targets inside the circles', () => {
  let seed = 20261125;
  const random = () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 2 ** 32;
  };
  const commonSymbols = new Set();
  const layouts = new Set();
  for (let index = 0; index < 20_000; index++) {
    const { common, cards } = makeRound(random);
    commonSymbols.add(common);
    const [first, second] = cards.map((card) => {
      assert.equal(card.length, 8);
      for (const [i, entry] of card.entries()) {
        assert.ok(entry.id >= 0 && entry.id < symbolNames.length);
        assert.ok(Math.hypot(entry.x - 50, entry.y - 50) + 11 <= 50);
        assert.ok(entry.scale >= .71 && entry.scale <= .95);
        assert.ok(Math.abs(entry.angle) <= 42);
        for (const other of card.slice(i + 1)) {
          // The button radius is 11% and the largest rotated artwork fits a 12.5% radius.
          assert.ok(Math.hypot(entry.x - other.x, entry.y - other.y) > 25);
        }
      }
      const ids = new Set(card.map(({ id }) => id));
      assert.equal(ids.size, 8);
      return ids;
    });
    assert.deepEqual([...first].filter((id) => second.has(id)), [common]);
    if (index < 100) layouts.add(JSON.stringify(cards));
  }
  assert.equal(commonSymbols.size, symbolNames.length);
  assert.equal(layouts.size, 100);
});

test('records prioritize fewer errors and then a faster time, and survive reading storage again', () => {
  const memory = new Map();
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    value: {
      getItem: (key) => memory.get(key),
      setItem: (key, value) => memory.set(key, value),
    },
  });
  const initial = readRecords();
  assert.deepEqual(initial, { best: null, latest: null });

  const result = { hits: roundsPerGame, errors: 2, duration: 8_200 };
  assert.equal(saveResult(result, initial).newRecord, true);
  assert.equal(isRecord({ ...result, errors: 1, duration: 20_000 }, result), true);
  assert.equal(isRecord({ ...result, errors: 3, duration: 6_000 }, result), false);
  assert.equal(isRecord({ ...result, duration: 7_000 }, result), true);
  assert.equal(isRecord(result, result), false);

  const latest = { ...result, errors: 3 };
  assert.equal(saveResult(latest, readRecords()).newRecord, false);
  assert.deepEqual(readRecords(), { best: result, latest });
  assert.equal(displayTime(68_240), '01:08.2');

  for (const key of memory.keys()) memory.set(key, '{invalid json');
  assert.deepEqual(readRecords(), initial);
  delete globalThis.localStorage;
});
