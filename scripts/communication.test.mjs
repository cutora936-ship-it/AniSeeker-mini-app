import assert from 'node:assert/strict';
import { after, test } from 'node:test';
import { createServer } from 'vite';

const server = await createServer({ server: { middlewareMode: true, watch: null }, appType: 'custom' });
after(() => server.close());
const { stories } = await server.ssrLoadModule('/src/data/communication/index.ts');
const { newRun, replay, takeChoice } = await server.ssrLoadModule('/src/communication/engine.ts');
const { readSave, writeSave } = await server.ssrLoadModule('/src/communication/storage.ts');

const endingIds = ['acquaintance', 'friendship', 'parting', 'repair', 'understanding'];
for (const [role, story] of Object.entries(stories)) {
  test(`${story.person.name}: every reachable path advances and all five endings are reachable`, () => {
    assert.equal(story.chapters.length, 10);
    const queue = [{ run: newRun(role, 1000), count: 0 }];
    const visits = new Set();
    const reached = new Set();
    const endings = new Set();
    const limits = Array.from({ length: 10 }, () => [Infinity, 0]);

    for (let cursor = 0; cursor < queue.length; cursor++) {
      let { run, count } = queue[cursor];
      let state = replay(story, run);
      if (state.gate) {
        const pair = limits[run.openedChapter];
        pair[0] = Math.min(pair[0], count);
        pair[1] = Math.max(pair[1], count);
        if (state.ending) {
          endings.add(state.ending);
          continue;
        }
        assert.ok(state.next, 'Missing transition');
        assert.equal(state.next.chapter, run.openedChapter + 1);
        run = { ...run, openedChapter: state.next.chapter };
        state = replay(story, run);
        count = 0;
      }

      const id = state.next.id;
      const visit = JSON.stringify([id, state.memory, count]);
      if (visits.has(visit)) continue;
      visits.add(visit);
      reached.add(id);
      assert.ok(state.next.messages.length);
      assert.ok(state.next.messages.every((line) => line.trim().length > 0));
      assert.ok(state.next.choices.length >= 2 && state.next.choices.length <= 4);
      assert.equal(new Set(state.next.choices.map((choice) => choice.text)).size, state.next.choices.length);
      for (const [index, choice] of state.next.choices.entries()) {
        assert.ok(choice.text && choice.reply);
        for (const target of [choice.next, ...(choice.branches ?? []).map(({ next }) => next)]) {
          assert.ok(target === 'ending' || Object.hasOwn(story.nodes, target), `${id}: ${target}`);
        }
        const next = takeChoice(story, run, index, 2000 + run.decisions.length);
        assert.notEqual(next, run);
        assert.ok(next.decisions.length <= Object.keys(story.nodes).length, 'Cycle detected');
        const advanced = replay(story, next);
        assert.notEqual(advanced.next?.id, id);
        assert.equal(advanced.history.findLast((message) => message.by === 'player')?.text, choice.text);
        queue.push({ run: next, count: count + 1 });
      }
    }

    assert.deepEqual([...endings].sort(), endingIds);
    assert.equal(reached.size, Object.keys(story.nodes).length);
    assert.deepEqual(limits.map((range) => range[0]), Array(10).fill(8));
    assert.ok(limits.every(([, max]) => max <= 12));
  });
}

test('reload reconstructs choices, timestamps, memory and pending chapter recap', () => {
  const storage = new Map();
  globalThis.localStorage = {
    getItem: (key) => storage.get(key) ?? null,
    setItem: (key, value) => storage.set(key, value),
  };
  try {
    let run = newRun('male', 12345);
    const story = stories.male;
    for (let i = 0; i < 8; i++) run = takeChoice(story, run, i % 2, 13000 + i);
    assert.equal(replay(story, run).gate, true);
    assert.strictEqual(takeChoice(story, run, 0, 14000), run);
    const saved = { run, endings: [{ role: 'female', ending: 'friendship', decisions: 80, completedAt: 12000 }] };
    const before = replay(story, run);
    writeSave(saved, story);
    const restored = readSave(stories);
    assert.deepEqual(restored, saved);
    assert.deepEqual(replay(story, restored.run), before);
    const next = replay(story, { ...restored.run, openedChapter: 1 });
    assert.equal(next.next.id, '2.1');
    assert.ok(next.history.slice(next.guide).every((message) => message.chapter === 1));
    assert.ok(next.history.some((message) => message.text.includes('трамвайным кольцом')));
    const corrupt = JSON.parse([...storage.values()][0]);
    corrupt.run.decisions[1].node = 'nonexistent';
    storage.set([...storage.keys()][0], JSON.stringify(corrupt));
    assert.deepEqual(readSave(stories), { run: null, endings: saved.endings });
  } finally {
    delete globalThis.localStorage;
  }
});
