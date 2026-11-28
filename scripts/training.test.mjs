import assert from 'node:assert/strict';
import { after, test } from 'node:test';
import { createServer } from 'vite';

const server = await createServer({ server: { middlewareMode: true, watch: null, ws: false }, appType: 'custom' });
after(() => server.close());
const { createUserStorage } = await server.ssrLoadModule('/src/account/storage.ts');
const { clearTraining, latestTraining, readTraining, writeTraining } =
  await server.ssrLoadModule('/src/training/storage.ts');

function makeStorage() {
  const contents = new Map();
  return {
    getItem: key => contents.get(key) ?? null,
    setItem: (key, value) => contents.set(key, value),
  };
}

const progress = { label: 'Раунд 2 из 10', total: 10, value: 1 };

test('the most recent unfinished training wins and finishing it reveals the older one', () => {
  const storage = makeStorage();
  assert.equal(latestTraining(storage), null);
  const match = { elapsed: 1225, pair: [12, 30], errors: 3 };
  writeTraining(storage, 'match', progress, match);
  writeTraining(storage, 'mastermind', progress, { guess: [4, 1] });
  const attempt = readTraining(storage, 'match');
  writeTraining(storage, 'match', progress, { ...match, elapsed: 1500 }, attempt.savedAt);
  assert.equal(latestTraining(storage).activity, 'mastermind');
  clearTraining(storage, 'mastermind');
  assert.equal(latestTraining(storage).activity, 'match');
  assert.deepEqual(readTraining(storage, 'match').data, { ...match, elapsed: 1500 });
  clearTraining(storage, 'match');
  assert.equal(latestTraining(storage), null);
});

test('unfinished activities are isolated across Telegram accounts and the browser guest', () => {
  globalThis.localStorage = makeStorage();
  try {
    const [first, second, guest] = ['telegram:42', 'telegram:100', 'guest'].map(createUserStorage);
    writeTraining(first, 'match', progress, { pair: [7, 10] });
    writeTraining(second, 'match', progress, { pair: [8, 10] });
    writeTraining(guest, 'stroop', progress, { turn: 1 });
    assert.deepEqual(readTraining(first, 'match').data.pair, [7, 10]);
    assert.deepEqual(readTraining(second, 'match').data.pair, [8, 10]);
    assert.equal(readTraining(guest, 'match'), null);
    clearTraining(first, 'match');
    assert.equal(latestTraining(first), null);
    assert.equal(latestTraining(second).activity, 'match');
    assert.equal(latestTraining(guest).activity, 'stroop');
  } finally {
    delete globalThis.localStorage;
  }
});

test('recognizes existing unfinished chess and story saves without changing them', () => {
  const storage = makeStorage();
  const chess = JSON.stringify({ puzzleId: 'strategy-07', moves: [], completed: ['strategy-01'] });
  const story = JSON.stringify({ run: { role: 'male', version: 2, started: 100, openedChapter: 2, finished: false, decisions: [{ at: 150 }] } });
  storage.setItem('aniseeker:strategy:v1', chess);
  assert.deepEqual(latestTraining(storage).progress,
    { label: 'Испытание 7 из 30', total: 30, value: 1, difficulty: 'Аналитик', savedAt: 0 });
  storage.setItem('aniseeker:communication:v1', story);
  assert.equal(latestTraining(storage).activity, 'communication');
  assert.equal(latestTraining(storage).progress.label, 'Глава 3 из 5');
  clearTraining(storage, 'communication');
  assert.equal(latestTraining(storage).activity, 'strategy');
  assert.equal(storage.getItem('aniseeker:communication:v1'), story);
  clearTraining(storage, 'strategy');
  assert.equal(latestTraining(storage), null);
  assert.equal(storage.getItem('aniseeker:strategy:v1'), chess);
});
