import { useCallback, useEffect, useRef, useState } from 'react';
import { useAccount } from '../account/current';
import type { UserStorage } from '../account/storage';

const storageKey = 'aniseeker:favorites:v1';

function readFavorites(storage: UserStorage): string[] {
  try {
    const saved: unknown = JSON.parse(storage.getItem(storageKey) ?? '[]');

    return Array.isArray(saved)
      ? [...new Set(saved.filter((id): id is string => typeof id === 'string'))]
      : [];
  } catch {
    return [];
  }
}

export function useFavorites() {
  const { storage, cloud } = useAccount();
  const [favoriteIds, setFavoriteIds] = useState(() => readFavorites(storage));
  const lastState = useRef(favoriteIds);

  useEffect(() => cloud?.subscribeData('favorites:v1', () => {
    lastState.current = readFavorites(storage);
    setFavoriteIds(lastState.current);
  }), [cloud, storage]);

  const toggleFavorite = useCallback((id: string) => {
    const current = lastState.current;
    const next = current.includes(id) ? current.filter((favorite) => favorite !== id) : [...current, id];
    lastState.current = next;
    setFavoriteIds(next);
    try {
      storage.setItem(storageKey, JSON.stringify(next));
    } catch {
      // Keep favorites usable for the current session when storage is blocked.
    }
  }, [storage]);

  return { favoriteIds, toggleFavorite };
}
