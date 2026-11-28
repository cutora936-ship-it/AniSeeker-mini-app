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
  const { storage } = useAccount();
  const [favoriteIds, setFavoriteIds] = useState(() => readFavorites(storage));
  const lastState = useRef(favoriteIds);

  useEffect(() => {
    if (lastState.current === favoriteIds) return;
    lastState.current = favoriteIds;
    try {
      storage.setItem(storageKey, JSON.stringify(favoriteIds));
    } catch {
      // Keep favorites usable for the current session when storage is blocked.
    }
  }, [favoriteIds, storage]);

  const toggleFavorite = useCallback((id: string) => {
    setFavoriteIds((current) =>
      current.includes(id) ? current.filter((favorite) => favorite !== id) : [...current, id],
    );
  }, []);

  return { favoriteIds, toggleFavorite };
}
