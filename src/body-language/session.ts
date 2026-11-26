import type { BodyLanguageQuestion } from '../data/bodyLanguageQuestions';

const storageKey = 'aniseeker:body-language:v1';

export interface Attempt {
  correct: number;
  total: number;
}

export interface Results {
  latest: Attempt | null;
  best: Attempt | null;
}

function shuffle<T>(items: readonly T[]): T[] {
  const order = [...items];
  for (let i = order.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [order[i], order[j]] = [order[j], order[i]];
  }
  return order;
}

export function createRound(questions: readonly BodyLanguageQuestion[], previous: readonly string[]) {
  const order = shuffle(questions);
  if (order.length > 1 && order.every((question, index) => question.id === previous[index])) {
    order.push(order.shift()!);
  }
  return order.map((question) => ({
    question,
    answerOrder: shuffle(question.answers.map((_, index) => index)),
  }));
}

function parseAttempt(value: unknown): Attempt | null {
  if (!value || typeof value !== 'object') return null;
  const { correct, total } = value as Attempt;
  return Number.isSafeInteger(total) && total > 0 && Number.isSafeInteger(correct)
    && correct >= 0 && correct <= total ? { correct, total } : null;
}

export function readResults(): Results {
  try {
    const saved = JSON.parse(localStorage.getItem(storageKey) ?? 'null');
    return { latest: parseAttempt(saved?.latest), best: parseAttempt(saved?.best) };
  } catch {
    return { latest: null, best: null };
  }
}

export function saveAttempt(attempt: Attempt, results: Results): Results {
  const best = results.best;
  // Compare accuracy even if the question bank grows between releases.
  const isBest = !best || attempt.correct * best.total > best.correct * attempt.total;
  const next = { latest: attempt, best: isBest ? attempt : best };
  try {
    localStorage.setItem(storageKey, JSON.stringify(next));
  } catch {
    // The current result stays visible when browser storage is unavailable.
  }
  return next;
}
