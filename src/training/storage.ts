import type { UserStorage } from '../account/storage';
import { communicationStorageKey } from '../communication/storage';
import type { Activity } from '../data/characters';
import { puzzlesPerLevel, strategyLevels, strategyStorageKey } from '../strategy/catalog';
import { activityCards } from './activities';

export interface TrainingProgress {
  label: string;
  value: number;
  total: number;
  difficulty?: string;
}

interface RecentProgress extends TrainingProgress {
  savedAt: number;
}

interface Checkpoint<T> extends RecentProgress {
  data: T;
}

let lastSavedAt = 0;

export function trainingTimestamp() {
  lastSavedAt = Math.max(Date.now(), lastSavedAt + 1);
  return lastSavedAt;
}

function key(activity: Activity) {
  return `aniseeker:training:${activity}:v1`;
}

export function readTraining<T>(storage: UserStorage, activity: Activity): Checkpoint<T> | null {
  try {
    const value = JSON.parse(storage.getItem(key(activity)) ?? 'null');
    if (value && typeof value.label === 'string' && Number.isFinite(value.savedAt)
      && Number.isFinite(value.total) && value.total > 0 && Number.isFinite(value.value)
      && value.value >= 0 && value.value <= value.total && value.data != null) return value;
  } catch { /* A damaged checkpoint cannot be resumed. */ }
  return null;
}

export function writeTraining<T>(storage: UserStorage, activity: Activity, progress: TrainingProgress, data: T, savedAt = trainingTimestamp()) {
  try {
    storage.setItem(key(activity), JSON.stringify({ ...progress, savedAt, data }));
  } catch { /* The current training remains playable without storage. */ }
}

export function clearTraining(storage: UserStorage, activity: Activity) {
  try { storage.setItem(key(activity), 'null'); } catch { /* Storage may be unavailable. */ }
}

function legacyProgress(storage: UserStorage, activity: Activity): RecentProgress | null {
  if (activity !== 'strategy' && activity !== 'communication') return null;
  try {
    if (storage.getItem(key(activity)) !== null) return null;

    if (activity === 'strategy') {
      const save = JSON.parse(storage.getItem(strategyStorageKey) ?? 'null');
      const puzzle = typeof save?.puzzleId === 'string' && /^strategy-\d{2}$/.test(save.puzzleId)
        ? Number(save.puzzleId.slice(-2)) : 0;
      const total = strategyLevels.length * puzzlesPerLevel;
      const value = Array.isArray(save?.completed) ? save.completed.length : 0;
      if (puzzle < 1 || puzzle > total || value >= total) return null;
      return {
        label: `Испытание ${puzzle} из ${total}`, value, total,
        difficulty: strategyLevels[Math.floor((puzzle - 1) / puzzlesPerLevel)],
        savedAt: 0, // Earlier chess saves had no timestamp.
      };
    }

    const run = JSON.parse(storage.getItem(communicationStorageKey) ?? 'null')?.run;
    const total = run?.version === 2 ? 5 : 10;
    if ((run?.role !== 'male' && run?.role !== 'female') || run.finished !== false
      || (run.version !== undefined && run.version !== 2) || !Array.isArray(run.decisions)
      || !Number.isFinite(run.started) || !Number.isInteger(run.openedChapter)
      || run.openedChapter < 0 || run.openedChapter >= total) return null;
    const lastDecision = run.decisions.at(-1)?.at;
    return {
      label: `Глава ${run.openedChapter + 1} из ${total}`, value: run.openedChapter, total,
      savedAt: Number.isFinite(lastDecision) ? Math.max(run.started, lastDecision) : run.started,
    };
  } catch {
    return null;
  }
}

export function latestTraining(storage: UserStorage) {
  let latest: { activity: Activity; progress: RecentProgress } | null = null;
  for (const { id } of activityCards) {
    const progress = readTraining(storage, id) ?? legacyProgress(storage, id);
    if (progress && (!latest || progress.savedAt > latest.progress.savedAt)) latest = { activity: id, progress };
  }
  return latest;
}
