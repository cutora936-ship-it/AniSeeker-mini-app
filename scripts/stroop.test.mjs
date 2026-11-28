import assert from 'node:assert/strict';
import { test } from 'node:test';
import { colors, judge, levels, makePrompts, readRecords, recordKey, saveRecord, summarize } from '../src/stroop/game.ts';

function rng(seed) {
  return () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 2 ** 32;
  };
}

test('all four levels generate varied prompts with valid colors and a majority of conflicting trials', () => {
  assert.equal(colors.length, 8);
  assert.deepEqual(Object.values(levels).map(({ colors, rounds, seconds }) => [colors, rounds, seconds]),
    [[4, 15, 0], [6, 20, 5], [8, 30, 3], [8, 40, 2]]);
  for (const level of Object.values(levels)) {
    const random = rng(18425);
    const seeds = new Set();
    const inks = new Set();
    const words = new Set();
    for (let i = 0; i < 150; i++) {
      const prompts = makePrompts(level, random);
      assert.equal(prompts.length, level.rounds);
      assert.equal(prompts.filter(({ ink, word }) => ink === word).length, Math.round(level.rounds / 5));
      for (const [index, { ink, word }] of prompts.entries()) {
        assert.ok(Number.isInteger(word) && word >= 0 && word < level.colors);
        assert.ok(Number.isInteger(ink) && ink >= 0 && ink < level.colors);
        assert.notDeepEqual(prompts[index - 1], { word, ink });
        inks.add(ink);
        words.add(word);
      }
      seeds.add(JSON.stringify(prompts));
    }
    assert.equal(inks.size, level.colors);
    assert.equal(words.size, level.colors);
    assert.equal(seeds.size, 150);
  }
});

test('answers depend on the displayed ink, and a late click is a skip', () => {
  const prompt = { ink: 0, word: 2 };
  assert.deepEqual(judge(prompt, 2, 750, 2000), { kind: 'wrong', elapsed: 750 });
  assert.deepEqual(judge(prompt, 0, 1999, 2000), { kind: 'correct', elapsed: 1999 });
  assert.deepEqual(judge(prompt, 0, 2000, 2000), { kind: 'timeout', elapsed: 2000 });
  assert.deepEqual(judge(prompt, null, 2100, 2000), { kind: 'timeout', elapsed: 2000 });
  assert.deepEqual(judge(prompt, 0, 9000, 0), { kind: 'correct', elapsed: 9000 });
  assert.deepEqual(judge({ ink: 1, word: 1 }, 1, 300, 0), { kind: 'correct', elapsed: 300 });
});

test('accuracy includes skips, with reaction times calculated only for correct answers', () => {
  const responses = [
    { kind: 'correct', elapsed: 250 }, { kind: 'correct', elapsed: 750 },
    { kind: 'wrong', elapsed: 130 }, { kind: 'timeout', elapsed: 2000 },
  ];
  assert.deepEqual(summarize(responses, 4200), {
    correct: 2, wrong: 1, skipped: 1, accuracy: 50, average: 500, best: 250, duration: 4200,
  });
  assert.equal(summarize(responses.slice(2), 2500).average, null);
  assert.equal(summarize(responses.slice(2), 2500).best, null);
});

test('records keep the most correct answers, then fastest average, separately per level and timer mode', (t) => {
  const memory = new Map();
  globalThis.localStorage = { getItem: (key) => memory.get(key) ?? null, setItem: (key, value) => memory.set(key, value) };
  t.after(() => { delete globalThis.localStorage; });
  const timed = recordKey('medium', true);
  const untimed = recordKey('medium', false);
  const expert = recordKey('expert', true);
  let records = readRecords();
  records = saveRecord(records, timed, { correct: 10, average: 900 });
  assert.strictEqual(saveRecord(records, timed, { correct: 8, average: 100 }), records);
  assert.strictEqual(saveRecord(records, timed, { correct: 10, average: 1200 }), records);
  records = saveRecord(records, timed, { correct: 10, average: 500 });
  records = saveRecord(records, untimed, { correct: 12, average: 700 });
  records = saveRecord(records, expert, { correct: 0, average: null });
  assert.deepEqual(readRecords(), {
    [timed]: { correct: 10, average: 500 },
    [untimed]: { correct: 12, average: 700 },
    [expert]: { correct: 0, average: null },
  });
  memory.set('aniseeker:stroop:records:v1', '{"medium:timed":{"correct":21,"average":42}}');
  assert.deepEqual(readRecords(), {});
});
