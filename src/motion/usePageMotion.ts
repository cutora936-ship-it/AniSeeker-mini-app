import { useLayoutEffect, useRef } from 'react';
import type { Activity } from '../data/characters';

type Screen = 'home' | 'favorites' | 'profile' | 'search' | 'detail' | Activity;

const depth: Record<Screen, number> = {
  home: 0, favorites: 0, profile: 0, search: 1, detail: 2, strategy: 3, match: 3, mastermind: 3,
};

export function usePageMotion(screen: Screen) {
  const main = useRef<HTMLElement>(null);
  const previous = useRef(screen);

  useLayoutEffect(() => {
    const from = previous.current;
    previous.current = screen;
    if (from === screen || document.hidden || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    const travel = Math.max(depth[from], depth[screen]) < 2
      ? 'translateY(4px)'
      : `translateX(${depth[from] <= depth[screen] ? 6 : -6}px)`;
    const animation = main.current?.animate?.(
      [{ transform: travel, opacity: .9 }, { transform: 'none', opacity: 1 }],
      { duration: 180, easing: 'cubic-bezier(.2,.65,.3,1)' },
    );
    return () => animation?.cancel();
  }, [screen]);

  return main;
}
