import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  generateSecret, getLevelProgress, levels, readProgress, rememberSecret, saveResult, scoreGuess,
} from '../src/mastermind/game.ts';

test('scores exact and displaced colors before revealing any position', () => {
  assert.deepEqual(scoreGuess([0, 1, 2], [0, 1, 2]), { exact: 3, misplaced: 0 });
  assert.deepEqual(scoreGuess([0, 1, 2], [1, 2, 0]), { exact: 0, misplaced: 3 });
  assert.deepEqual(scoreGuess([0, 1, 2], [0, 2, 3]), { exact: 1, misplaced: 1 });
  assert.deepEqual(scoreGuess([0, 1, 2], [3, 4, 5]), { exact: 0, misplaced: 0 });
});

test('repeated colors never reuse a color already counted for an exact or displaced match', () => {
  assert.deepEqual(scoreGuess([1, 2, 2, 3], [1, 1, 1, 2]), { exact: 1, misplaced: 1 });
  assert.deepEqual(scoreGuess([1, 2, 2, 3], [2, 3, 1, 2]), { exact: 0, misplaced: 4 });
  assert.deepEqual(scoreGuess([4, 4, 1, 1], [1, 1, 1, 1]), { exact: 2, misplaced: 0 });
  assert.deepEqual(scoreGuess([0, 0, 1, 1, 2, 2], [2, 2, 1, 3, 2, 2]), { exact: 3, misplaced: 0 });
});

test('generation obeys all five settings and avoids the eight most recent codes', () => {
  let seed = 553194;
  const random = () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 2 ** 32;
  };

  for (const level of Object.values(levels)) {
    const recent = [];
    let repeatedColors = false;
    for (let round = 0; round < 500; round++) {
      const secret = generateSecret(level, recent, random);
      const key = secret.join('');
      assert.equal(secret.length, level.size);
      assert.ok(secret.every((color) => Number.isInteger(color) && color >= 0 && color < level.colors));
      if (new Set(secret).size !== level.size) repeatedColors = true;
      assert.ok(!recent.includes(key), `${level.name}: ${key}`);
      recent.unshift(key);
      recent.splice(8);
    }
    assert.equal(repeatedColors, level.repeats);
  }
});

test('a constant random source cannot repeat the last code or make generation hang', () => {
  for (const level of Object.values(levels)) {
    const recent = [];
    for (let round = 0; round < 9; round++) {
      const secret = generateSecret(level, recent, () => 0);
      const key = secret.join('');
      assert.ok(!recent.includes(key));
      recent.unshift(key);
      recent.splice(8);
    }
  }
});

test('local statistics keep the quickest win among the fewest attempts per level', (t) => {
  const storage = new Map();
  t.after(() => { delete globalThis.localStorage; });
  globalThis.localStorage = {
    getItem: (key) => storage.get(key) ?? null,
    setItem: (key, value) => storage.set(key, value),
  };
  let progress = rememberSecret(globalThis.localStorage, {}, 'beginner', [0, 1, 2]);
  progress = saveResult(globalThis.localStorage, progress, 'beginner', false, { attempts: 10, duration: 600 });
  assert.equal(getLevelProgress(progress, 'beginner').best, null);
  progress = saveResult(globalThis.localStorage, progress, 'beginner', true, { attempts: 3, duration: 12000 });
  progress = saveResult(globalThis.localStorage, progress, 'beginner', true, { attempts: 4, duration: 9000 });
  progress = saveResult(globalThis.localStorage, progress, 'beginner', true, { attempts: 2, duration: 15000 });
  progress = saveResult(globalThis.localStorage, progress, 'beginner', true, { attempts: 2, duration: 11000 });
  progress = saveResult(globalThis.localStorage, progress, 'expert', true, { attempts: 5, duration: 24000 });

  const restored = readProgress(globalThis.localStorage);
  assert.deepEqual(restored.beginner, {
    played: 5, wins: 4, best: { attempts: 2, duration: 11000 }, recent: ['012'],
  });
  assert.deepEqual(restored.expert.best, { attempts: 5, duration: 24000 });
});
