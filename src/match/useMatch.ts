import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { makeRound, roundsPerGame, type MatchRound } from './round';
import { readRecords, saveResult, type MatchResult } from './records';

type Session =
  | { phase: 'welcome' }
  | { phase: 'playing'; pair: MatchRound; startedAt: number; hits: number; errors: number }
  | { phase: 'results'; result: MatchResult; newRecord: boolean };

export interface Feedback {
  id: number;
  card: number;
  correct: boolean;
}

export function useMatch(onPlayingChange: (active: boolean) => void) {
  const [session, setSession] = useState<Session>({ phase: 'welcome' });
  const [records, setRecords] = useState(readRecords);
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const locked = useRef(false);
  const feedbackTimeout = useRef<number | undefined>(undefined);
  const startedAt = session.phase === 'playing' && session.hits < roundsPerGame ? session.startedAt : null;

  useEffect(() => {
    if (startedAt === null) return;
    const timer = window.setInterval(() => setElapsed(performance.now() - startedAt), 100);
    return () => window.clearInterval(timer);
  }, [startedAt]);

  useEffect(() => () => window.clearTimeout(feedbackTimeout.current), []);

  useLayoutEffect(() => {
    if (!feedback) locked.current = false;
  }, [feedback]);

  function start() {
    window.clearTimeout(feedbackTimeout.current);
    locked.current = false;
    setFeedback(null);
    setElapsed(0);
    setSession({ phase: 'playing', pair: makeRound(), startedAt: performance.now(), hits: 0, errors: 0 });
    onPlayingChange(true);
  }

  function answer(card: number, id: number) {
    if (session.phase !== 'playing' || locked.current) return;
    locked.current = true;
    const correct = id === session.pair.common;
    const hits = session.hits + Number(correct);
    const errors = session.errors + Number(!correct);
    const next = { ...session, hits, errors };
    setFeedback({ id, card, correct });
    setSession(next);

    if (hits === roundsPerGame) {
      const duration = performance.now() - session.startedAt;
      const result = { hits, errors, duration };
      const saved = saveResult(result, records);
      setRecords(saved.records);
      setElapsed(duration);
      feedbackTimeout.current = window.setTimeout(() => {
        setFeedback(null);
        setSession({ phase: 'results', result, newRecord: saved.newRecord });
        onPlayingChange(false);
      }, 320);
      return;
    }

    feedbackTimeout.current = window.setTimeout(() => {
      if (correct) setSession({ ...next, pair: makeRound() });
      setFeedback(null);
    }, correct ? 300 : 230);
  }

  return { session, records, feedback, elapsed, start, answer };
}
