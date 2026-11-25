export const levels = {
  beginner: { name: 'Новичок', colors: 4, size: 3, attempts: 10, repeats: false },
  easy: { name: 'Лёгкий', colors: 6, size: 4, attempts: 10, repeats: false },
  medium: { name: 'Средний', colors: 6, size: 4, attempts: 10, repeats: true },
  hard: { name: 'Сложный', colors: 8, size: 5, attempts: 12, repeats: true },
  expert: { name: 'Эксперт', colors: 8, size: 6, attempts: 12, repeats: true },
} as const;

export type LevelId = keyof typeof levels;
export type Level = (typeof levels)[LevelId];

export interface Clue {
  exact: number;
  misplaced: number;
}

export function scoreGuess(secret: readonly number[], guess: readonly number[]): Clue {
  let exact = 0;
  const unmatchedSecret = new Map<number, number>();
  const unmatchedGuess: number[] = [];

  secret.forEach((color, index) => {
    if (color === guess[index]) {
      exact++;
    } else {
      unmatchedSecret.set(color, (unmatchedSecret.get(color) ?? 0) + 1);
      unmatchedGuess.push(guess[index]);
    }
  });

  let misplaced = 0;
  for (const color of unmatchedGuess) {
    const remaining = unmatchedSecret.get(color) ?? 0;
    if (remaining > 0) {
      misplaced++;
      unmatchedSecret.set(color, remaining - 1);
    }
  }
  return { exact, misplaced };
}

function isValidKey(key: string, level: Level) {
  return key.length === level.size && [...key].every((digit) => digit >= '0' && Number(digit) < level.colors)
    && (level.repeats || new Set(key).size === level.size);
}

const recentLimit = 8;

export function generateSecret(level: Level, recent: readonly string[], random = Math.random): number[] {
  const blocked = new Set(recent.slice(0, recentLimit));
  for (let attempt = 0; attempt < 16; attempt++) {
    const available = Array.from({ length: level.colors }, (_, color) => color);
    const code = Array.from({ length: level.size }, () => {
      const index = Math.floor(random() * available.length);
      return level.repeats ? available[index] : available.splice(index, 1)[0];
    });
    if (!blocked.has(code.join(''))) return code;
  }

  // Bound retries even if the random source keeps returning the same code.
  // Eight exclusions cannot exhaust any level (the smallest has 24 codes).
  for (let index = 0; index < level.colors ** level.size; index++) {
    const key = index.toString(level.colors).padStart(level.size, '0');
    if (!blocked.has(key) && isValidKey(key, level)) return [...key].map(Number);
  }
  throw new Error('No available code');
}

export interface RecordResult {
  attempts: number;
  duration: number;
}

export interface LevelProgress {
  played: number;
  wins: number;
  best: RecordResult | null;
  recent: string[];
}

export type Progress = Partial<Record<LevelId, LevelProgress>>;

const storageKey = 'aniseeker:mastermind:v1';

export function getLevelProgress(progress: Progress, id: LevelId): LevelProgress {
  return progress[id] ?? { played: 0, wins: 0, best: null, recent: [] };
}

const isCount = (value: unknown): value is number => typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;

export function readProgress(): Progress {
  try {
    const saved = JSON.parse(localStorage.getItem(storageKey) ?? 'null');
    const progress: Progress = {};

    for (const id of Object.keys(levels) as LevelId[]) {
      const entry = saved?.[id];
      if (!entry || typeof entry !== 'object') continue;
      const level = levels[id];
      const played = isCount(entry.played) ? entry.played : 0;
      const wins = isCount(entry.wins) ? Math.min(played, entry.wins) : 0;
      const best = entry.best;
      progress[id] = {
        played, wins,
        best: best && isCount(best.attempts) && best.attempts > 0 && best.attempts <= level.attempts
          && Number.isFinite(best.duration) && best.duration >= 0
          ? { attempts: best.attempts, duration: best.duration }
          : null,
        recent: Array.isArray(entry.recent)
          ? entry.recent.filter((key: unknown) => typeof key === 'string' && isValidKey(key, level)).slice(0, recentLimit)
          : [],
      };
    }
    return progress;
  } catch {
    return {};
  }
}

function storeProgress(progress: Progress, id: LevelId, entry: LevelProgress): Progress {
  const next = { ...progress, [id]: entry };
  try {
    localStorage.setItem(storageKey, JSON.stringify(next));
  } catch {
    // Keep the game usable when browser storage is unavailable.
  }
  return next;
}

export function rememberSecret(progress: Progress, id: LevelId, secret: readonly number[]): Progress {
  const entry = getLevelProgress(progress, id);
  const key = secret.join('');
  const recent = [key, ...entry.recent.filter((previous) => previous !== key)].slice(0, recentLimit);
  return storeProgress(progress, id, { ...entry, recent });
}

export function saveResult(progress: Progress, id: LevelId, won: boolean, result: RecordResult): Progress {
  const entry = getLevelProgress(progress, id);
  const { best } = entry;
  const isRecord = won && (!best || result.attempts < best.attempts
    || (result.attempts === best.attempts && result.duration < best.duration));
  return storeProgress(progress, id, {
    ...entry, played: entry.played + 1, wins: entry.wins + Number(won), best: isRecord ? result : best,
  });
}
