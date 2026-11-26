import assert from 'node:assert/strict';
import { after, test } from 'node:test';
import { createServer } from 'vite';

const server = await createServer({ server: { middlewareMode: true, watch: null }, appType: 'custom' });
after(() => server.close());
const { stories, legacyStories, storyFor } = await server.ssrLoadModule('/src/data/communication/index.ts');
const { newRun, recordDelivery, replay, takeChoice } = await server.ssrLoadModule('/src/communication/engine.ts');
const { readSave, writeSave } = await server.ssrLoadModule('/src/communication/storage.ts');

const { typingDelay, afterDelivery, scheduleMessage } = await server.ssrLoadModule('/src/communication/queue.ts');

const endingIds = ['acquaintance', 'friendship', 'parting', 'repair', 'understanding'];
for (const [role, story] of Object.entries(stories)) {
  test(`${story.person.name}: every reachable path advances and all five endings are reachable`, () => {
    assert.equal(story.chapters.length, 5);
    const queue = [{ run: newRun(role, 1000), count: 0 }];
    const visits = new Set();
    const reached = new Set();
    const endings = new Set();
    const limits = Array.from({ length: story.chapters.length }, () => [Infinity, 0]);

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
    assert.deepEqual(limits.map((range) => range[0]), [4, 3, 4, 3, 2]);
    assert.ok(limits.every(([, max]) => max <= 5));
  });
}


test('reload resumes only undelivered messages, using the original timestamps', () => {
  let run = newRun('male', 12345);
  run = recordDelivery(run, 0, 13000);
  assert.strictEqual(recordDelivery(run, 0, 13001), run);
  assert.strictEqual(recordDelivery(run, 2, 13001), run);
  const saved = { run, endings: [] };
  const story = stories.male;
  writeSave(saved, story);
  assert.deepEqual(readSave(storyFor), saved);
  const before = replay(story, readSave(storyFor).run);
  assert.equal(before.history[0].at, 13000);
  assert.equal(before.history.length, 2);
  run = recordDelivery(run, 1, 14000);
  const next = takeChoice(story, run, 0, 15000);
  assert.equal(next.delivered, 3);
  assert.equal(replay(story, next).history[2].by, 'player');
  assert.equal(replay(story, next).history[2].at, 15000);
});

test('v1 saves retain their original dialogue, chapter progress and unlocked ending', () => {
  for (const role of ['male', 'female']) {
    const story = legacyStories[role];
    let run = { role, started: 12345, decisions: [], openedChapter: 0, finished: false };
    for (let i = 0; i < 8; i++) run = takeChoice(story, run, i % 2, 13000 + i);
    delete run.delivered;
    const before = replay(story, run);
    const endings = [{ role, ending: 'friendship', decisions: 80, completedAt: 12000 }];
    writeSave({ run, endings }, story);
    const restored = readSave(storyFor);
    assert.deepEqual(restored.endings, endings);
    assert.equal(storyFor(restored.run), story);
    assert.deepEqual(replay(story, restored.run), before);
    assert.equal(restored.run.delivered, before.history.length);
    assert.equal(before.gate, true);
    const next = replay(story, { ...restored.run, openedChapter: 1 });
    assert.equal(next.next.id, '2.1');
    assert.ok(next.history.length > restored.run.delivered);
  }
});

const memory = new Map();
globalThis.localStorage = {
  getItem: (key) => memory.get(key) ?? null,
  setItem: (key, value) => memory.set(key, value),
};
after(() => { delete globalThis.localStorage; });


test('typing duration varies with text and jitter, and remains in bounds', () => {
  assert.equal(typingDelay('', () => 0), 500);
  assert.ok(typingDelay('длиннее', () => 0) > typingDelay('корот', () => 0));
  assert.ok(typingDelay('длиннее', () => .99) > typingDelay('длиннее', () => 0));
  assert.equal(typingDelay('я'.repeat(500), () => 0), 2500);
  assert.equal(afterDelivery(0, 3), 'pause');
  assert.equal(afterDelivery(1, 3), 'pause');
  assert.equal(afterDelivery(2, 3), 'idle');
});

test('replacing and cancelling the active timer leaves exactly one delivery', (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const delivered = [];
  const slow = scheduleMessage(1500, () => delivered.push(1));
  slow();
  scheduleMessage(140, () => delivered.push(1));
  t.mock.timers.tick(139);
  assert.deepEqual(delivered, []);
  t.mock.timers.tick(1);
  assert.deepEqual(delivered, [1]);
  const leave = scheduleMessage(700, () => delivered.push(2));
  leave();
  t.mock.timers.tick(4000);
  assert.deepEqual(delivered, [1]);
});
