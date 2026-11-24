import { useEffect, useState } from 'react';

const storageKey = 'aniseeker:favorites:v1';

function readFavorites(): string[] {
  try {
    const saved: unknown = JSON.parse(localStorage.getItem(storageKey) ?? '[]');

    return Array.isArray(saved)
      ? [...new Set(saved.filter((id): id is string => typeof id === 'string'))]
      : [];
  } catch {
    return [];
  }
}

export function useFavorites() {
  const [favoriteIds, setFavoriteIds] = useState(readFavorites);

  useEffect(() => {
    try {
      localStorage.setItem(storageKey, JSON.stringify(favoriteIds));
    } catch {
      // Keep favorites usable for the current session when storage is blocked.
    }
  }, [favoriteIds]);

  function toggleFavorite(id: string) {
    setFavoriteIds((current) =>
      current.includes(id) ? current.filter((favorite) => favorite !== id) : [...current, id],
    );
  }

  return { favoriteIds, toggleFavorite };
}
