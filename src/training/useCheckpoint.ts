import { useEffectEvent, useLayoutEffect, useRef, useState } from 'react';
import { useAccount } from '../account/current';
import type { Activity } from '../data/characters';
import { clearTraining, readTraining, trainingTimestamp, writeTraining, type TrainingProgress } from './storage';
import { useTrainingForeground } from './time';

export function useSavedTraining<T>(activity: Activity) {
  const { storage } = useAccount();
  const [saved] = useState(() => readTraining<T>(storage, activity)?.data);
  return saved;
}

export function useTrainingCheckpoint<T>(
  activity: Activity,
  data: T | null,
  progress: TrainingProgress,
  captureTime?: (data: T) => T,
) {
  const { storage } = useAccount();
  const active = useTrainingForeground();
  const savedAt = useRef(0);
  const previous = useRef(data);
  const discarded = useRef(false);

  const save = useEffectEvent((touch: boolean) => {
    if (data === null || discarded.current) return;
    if (touch || !savedAt.current) savedAt.current = trainingTimestamp();
    writeTraining(storage, activity, progress, captureTime ? captureTime(data) : data, savedAt.current);
  });

  useLayoutEffect(() => {
    if (data !== null) save(true);
    else if (previous.current !== null) clearTraining(storage, activity);
    previous.current = data;
  }, [activity, data, progress.label, progress.value, progress.total, progress.difficulty, storage]);

  useLayoutEffect(() => {
    if (!captureTime || data === null) return;
    if (!active) { save(false); return; }
    const timer = window.setInterval(() => save(false), 1000);
    return () => { window.clearInterval(timer); save(false); };
  }, [active, Boolean(captureTime), data !== null]);

  return () => {
    discarded.current = true;
    clearTraining(storage, activity);
  };
}
