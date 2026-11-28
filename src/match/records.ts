import type { UserStorage } from '../account/storage';
export interface MatchResult {
  hits: number;
  errors: number;
  duration: number;
}

export interface MatchRecords {
  best: MatchResult | null;
  latest: MatchResult | null;
}

const storageKey = 'aniseeker:observation-match:v1';

function validResult(value: unknown): value is MatchResult {
  if (!value || typeof value !== 'object') return false;
  const { hits, errors, duration } = value as MatchResult;
  return hits === 10 && Number.isSafeInteger(errors) && errors >= 0 && Number.isFinite(duration) && duration >= 0;
}

export function readRecords(storage: UserStorage): MatchRecords {
  try {
    const value = JSON.parse(storage.getItem(storageKey) ?? 'null');
    return { best: validResult(value?.best) ? value.best : null, latest: validResult(value?.latest) ? value.latest : null };
  } catch {
    return { best: null, latest: null };
  }
}

export function isRecord(result: MatchResult, best: MatchResult | null) {
  return !best || result.errors < best.errors || (result.errors === best.errors && result.duration < best.duration);
}

export function saveResult(storage: UserStorage, result: MatchResult, previous: MatchRecords) {
  const newRecord = isRecord(result, previous.best);
  const records = { latest: result, best: newRecord ? result : previous.best };

  try {
    storage.setItem(storageKey, JSON.stringify(records));
  } catch {
    // Keep the current record visible when storage is unavailable.
  }
  return { records, newRecord };
}

export function displayTime(milliseconds: number) {
  const tenths = Math.floor(milliseconds / 100);
  const minutes = Math.floor(tenths / 600);
  const seconds = Math.floor(tenths / 10) % 60;
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}.${tenths % 10}`;
}
