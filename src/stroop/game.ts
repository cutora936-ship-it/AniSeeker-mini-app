import type { UserStorage } from '../account/storage';
export const colors = [
  { name: 'Красный', ink: '#FF5268' },
  { name: 'Синий', ink: '#4F9DFF' },
  { name: 'Зелёный', ink: '#42DB91' },
  { name: 'Жёлтый', ink: '#FFD65A' },
  { name: 'Фиолетовый', ink: '#AB79FF' },
  { name: 'Оранжевый', ink: '#FF974D' },
  { name: 'Розовый', ink: '#FF78BC' },
  { name: 'Бирюзовый', ink: '#35D9D0' },
] as const;

export const levels = {
  beginner: { name: 'Новичок', colors: 4, rounds: 15, seconds: 0 },
  medium: { name: 'Средний', colors: 6, rounds: 20, seconds: 5 },
  hard: { name: 'Сложный', colors: 8, rounds: 30, seconds: 3 },
  expert: { name: 'Эксперт', colors: 8, rounds: 40, seconds: 2 },
} as const;

export type LevelId = keyof typeof levels;
export type Level = (typeof levels)[LevelId];
export type Prompt = { word: number; ink: number };

export function makePrompts(level: Level, random = Math.random): Prompt[] {
  // Around one fifth coincide, with their positions sampled without replacement.
  let matching = Math.round(level.rounds / 5);
  const prompts: Prompt[] = [];
  for (let i = 0; i < level.rounds; i++) {
    const same = random() < matching / (level.rounds - i);
    if (same) matching--;
    const previous = prompts.at(-1);
    const candidates: Prompt[] = [];
    for (let ink = 0; ink < level.colors; ink++) {
      for (let word = 0; word < level.colors; word++) {
        if ((word === ink) === same && (word !== previous?.word || ink !== previous.ink)) {
          candidates.push({ word, ink });
        }
      }
    }
    prompts.push(candidates[Math.floor(random() * candidates.length)]);
  }
  return prompts;
}

export type Response = { kind: 'correct' | 'wrong' | 'timeout'; elapsed: number };

export function judge(prompt: Prompt, selected: number | null, elapsed: number, limit: number): Response {
  if (selected === null || (limit > 0 && elapsed >= limit)) return { kind: 'timeout', elapsed: limit };
  return { kind: selected === prompt.ink ? 'correct' : 'wrong', elapsed };
}

export function summarize(responses: readonly Response[], duration: number) {
  const correctTimes = responses.filter(({ kind }) => kind === 'correct').map(({ elapsed }) => elapsed);
  return {
    correct: correctTimes.length,
    wrong: responses.filter(({ kind }) => kind === 'wrong').length,
    skipped: responses.filter(({ kind }) => kind === 'timeout').length,
    accuracy: responses.length ? Math.round(correctTimes.length * 100 / responses.length) : 0,
    average: correctTimes.length ? correctTimes.reduce((total, time) => total + time, 0) / correctTimes.length : null,
    best: correctTimes.length ? Math.min(...correctTimes) : null,
    duration,
  };
}

export interface RecordScore {
  correct: number;
  average: number | null;
}

export type RecordKey = `${LevelId}:${'timed' | 'untimed'}`;
export type Records = Partial<Record<RecordKey, RecordScore>>;

export function recordKey(level: LevelId, timed: boolean): RecordKey {
  return `${level}:${timed ? 'timed' : 'untimed'}`;
}

export function readRecords(storage: UserStorage): Records {
  try {
    const data = JSON.parse(storage.getItem('aniseeker:stroop:records:v1') ?? 'null');
    const records: Records = {};
    for (const id of Object.keys(levels) as LevelId[]) {
      for (const timed of [false, true]) {
        const key = recordKey(id, timed);
        const score = data?.[key];
        if (Number.isInteger(score?.correct) && score.correct >= 0 && score.correct <= levels[id].rounds
          && (score.correct === 0 ? score.average === null : Number.isFinite(score.average) && score.average >= 0)) {
          records[key] = { correct: score.correct, average: score.average };
        }
      }
    }
    return records;
  } catch {
    return {};
  }
}

export function saveRecord(storage: UserStorage, records: Records, key: RecordKey, score: RecordScore): Records {
  const best = records[key];
  if (best && (best.correct > score.correct || (best.correct === score.correct
    && (best.average ?? Infinity) <= (score.average ?? Infinity)))) return records;
  const next = { ...records, [key]: { correct: score.correct, average: score.average } };
  try { storage.setItem('aniseeker:stroop:records:v1', JSON.stringify(next)); } catch { /* Storage may be blocked. */ }
  return next;
}
