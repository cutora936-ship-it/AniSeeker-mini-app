import { useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useAccount } from '../account/current';
import { useSavedTraining, useTrainingCheckpoint } from '../training/useCheckpoint';
import { useTrainingClock, useTrainingDelay } from '../training/time';
import { makeRound, roundsPerGame, type MatchRound } from './round';
import { readRecords, saveResult, type MatchResult } from './records';

type Session =
  | { phase: 'welcome' }
  | { phase: 'playing'; pair: MatchRound; hits: number; errors: number; finishedDuration?: number }
  | { phase: 'results'; result: MatchResult; newRecord: boolean };

export interface Feedback {
  id: number;
  card: number;
  correct: boolean;
}

type Save = {
  session: Extract<Session, { phase: 'playing' }>;
  feedback: Feedback | null;
  nextPair: MatchRound | null;
  elapsed: number;
};

export function useMatch(onPlayingChange: (active: boolean) => void) {
  const { storage } = useAccount();
  const saved = useSavedTraining<Save>('match');
  const [session, setSession] = useState<Session>(() => saved?.session ?? { phase: 'welcome' });
  const [records, setRecords] = useState(() => readRecords(storage));
  const [feedback, setFeedback] = useState<Feedback | null>(() => saved?.feedback ?? null);
  const [nextPair, setNextPair] = useState<MatchRound | null>(() => saved?.nextPair ?? null);
  const result = useRef<Extract<Session, { phase: 'results' }> | null>(null);
  const locked = useRef(Boolean(saved?.feedback));
  const playing = session.phase === 'playing';
  const running = playing && session.finishedDuration === undefined;
  const clock = useTrainingClock(saved?.elapsed ?? 0, running);
  const checkpoint = useMemo<Save | null>(() => running
    ? { session, feedback, nextPair, elapsed: 0 }
    : null, [running, session, feedback, nextPair]);
  useTrainingCheckpoint('match', checkpoint, {
    label: `Раунд ${playing ? Math.min(session.hits + 1, roundsPerGame) : 1} из ${roundsPerGame}`,
    value: playing ? session.hits : 0,
    total: roundsPerGame,
  }, (data) => ({ ...data, elapsed: clock.elapsed() }));

  useLayoutEffect(() => {
    onPlayingChange(playing);
  }, [playing, onPlayingChange]);

  useTrainingDelay(feedback ? (result.current ? 320 : feedback.correct ? 300 : 230) : null, () => {
    if (result.current) {
      setSession(result.current);
      result.current = null;
    } else if (session.phase === 'playing' && nextPair) {
      setSession({ ...session, pair: nextPair });
    }
    setFeedback(null);
    setNextPair(null);
    locked.current = false;
  }, feedback);

  function start() {
    clock.reset();
    locked.current = false;
    setFeedback(null);
    setNextPair(null);
    setSession({ phase: 'playing', pair: makeRound(), hits: 0, errors: 0 });
  }

  function answer(card: number, id: number) {
    if (session.phase !== 'playing' || locked.current) return;
    locked.current = true;
    const correct = id === session.pair.common;
    const hits = session.hits + Number(correct);
    const errors = session.errors + Number(!correct);
    const next = { ...session, hits, errors };
    setFeedback({ id, card, correct });
    if (hits === roundsPerGame) {
      const duration = clock.elapsed();
      const score = { hits, errors, duration };
      const savedResult = saveResult(storage, score, records);
      result.current = { phase: 'results', result: score, newRecord: savedResult.newRecord };
      setSession({ ...next, finishedDuration: duration });
      setRecords(savedResult.records);
    } else {
      setSession(next);
      if (correct) setNextPair(makeRound());
    }
  }

  return { session, records, feedback, elapsed: clock.elapsed, start, answer };
}
