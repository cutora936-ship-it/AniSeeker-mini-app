import { replay } from './engine';
import type { Run } from './engine';
import type { Ending, Role, Story } from './types';

export interface Saved {
  run: Run | null;
  endings: { role: Role; ending: Ending; decisions: number; completedAt: number }[];
}

const storageKey = 'aniseeker:communication:v1';

function validDate(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0 && value <= 8.64e15;
}

export function readSave(storyFor: (run: Run) => Story): Saved {
  const empty: Saved = { run: null, endings: [] };
  try {
    const saved = JSON.parse(localStorage.getItem(storageKey) ?? 'null');
    const endings: Saved['endings'] = Array.isArray(saved?.endings) ? saved.endings.filter((entry: Saved['endings'][number]) =>
      (entry?.role === 'male' || entry?.role === 'female') && typeof entry.ending === 'string'
      && ['understanding', 'friendship', 'acquaintance', 'repair', 'parting'].includes(entry.ending)
      && validDate(entry.completedAt) && Number.isSafeInteger(entry.decisions) && entry.decisions > 0,
    ) : [];
    const run = saved?.run;
    if (run?.role !== 'male' && run?.role !== 'female') return { ...empty, endings };
    if (run.version !== undefined && run.version !== 2) return { ...empty, endings };
    const story = storyFor(run);
    const decisions = run.decisions;
    if (!validDate(run.started) || !Array.isArray(decisions) || decisions.length > Object.keys(story.nodes).length
      || typeof run.finished !== 'boolean' || !Number.isInteger(run.openedChapter)
      || run.openedChapter < 0 || run.openedChapter >= story.chapters.length
      || decisions.some((decision) => !decision || typeof decision.node !== 'string' || !Number.isInteger(decision.choice) || !validDate(decision.at))) {
      return { ...empty, endings };
    }
    for (const field of ['received', 'chapterTimes'] as const) {
      const timestamps = run[field];
      if (timestamps && (typeof timestamps !== 'object' || Array.isArray(timestamps)
        || Object.values(timestamps).some((at) => !validDate(at)))) delete run[field];
    }
    const state = replay(story, run);
    const valid = state.chosen.length === decisions.length
      && (!run.finished || state.ending !== undefined)
      && (!state.next || state.next.chapter >= run.openedChapter)
      && (state.chosen.at(-1)?.chapter ?? 0) >= run.openedChapter - 1;
    if (valid && (!Number.isInteger(run.delivered) || run.delivered < state.guide || run.delivered > state.history.length)) {
      // Older saves have no delivery cursor. Their existing transcript should open silently.
      run.delivered = state.history.length;
    }
    return { run: valid ? run : null, endings };
  } catch {
    return empty;
  }
}

export function writeSave(save: Saved, story?: Story, cached?: ReturnType<typeof replay>) {
  try {
    const state = cached ?? (save.run && story ? replay(story, save.run) : null);
    // Decisions and timestamps are the canonical replay log. The checkpoint is useful for inspecting saves.
    localStorage.setItem(storageKey, JSON.stringify({
      ...save,
      checkpoint: state && {
        chapter: save.run?.openedChapter, node: state.next?.id, memory: state.memory,
        result: save.run?.finished ? state.ending : undefined,
      },
    }));
  } catch {
    // The current story remains playable when storage is unavailable.
  }
  return save;
}
