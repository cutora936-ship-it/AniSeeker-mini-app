import { useCallback, useLayoutEffect, useRef } from 'react';
import { flushSync } from 'react-dom';

type PageMotion = 'tab' | 'push' | 'pop' | 'search-in' | 'search-out';

const arrival: Record<PageMotion, Keyframe> = {
  tab: { translate: '0 5px', opacity: .78 },
  push: { translate: 'min(7vw, 30px) 0', opacity: .8 },
  pop: { translate: '-12px 0', opacity: .78 },
  'search-in': { translate: '0 5px', opacity: .8 },
  'search-out': { translate: '0 -4px', opacity: .82 },
};

export function usePageMotion() {
  const main = useRef<HTMLElement>(null);
  const active = useRef<ViewTransition | null>(null);
  const entry = useRef<Animation | null>(null);

  const animateEntry = useCallback((motion: PageMotion) => {
    entry.current?.cancel();
    entry.current = main.current?.animate?.(
      [arrival[motion], { translate: 'none', opacity: 1 }],
      { duration: motion === 'push' || motion === 'pop' ? 245 : 205, easing: 'cubic-bezier(.2,.72,.25,1)' },
    ) ?? null;
  }, []);

  useLayoutEffect(() => {
    if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches) animateEntry('tab');
    return () => {
      entry.current?.cancel();
      active.current?.skipTransition();
      active.current = null;
      delete document.documentElement.dataset.pageMotion;
    };
  }, [animateEntry]);

  const navigate = useCallback((motion: PageMotion, update: () => void) => {
    entry.current?.cancel();
    const previous = active.current;
    if (previous) {
      active.current = null;
      previous.skipTransition();
      delete document.documentElement.dataset.pageMotion;
    }

    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches || document.hidden) {
      flushSync(update);
      return;
    }

    // Search updates synchronously so mobile browsers can focus the input in the tap gesture.
    if (previous || !document.startViewTransition || motion === 'search-in' || motion === 'search-out') {
      flushSync(update);
      animateEntry(motion);
      return;
    }

    const root = document.documentElement;
    root.dataset.pageMotion = motion;
    const next = document.startViewTransition(() => {
      // An interrupted capture must not run an outdated navigation update.
      if (active.current === next) flushSync(update);
    });
    active.current = next;
    function clear() {
      if (active.current !== next) return;
      active.current = null;
      delete root.dataset.pageMotion;
    }
    void next.ready.catch(() => {});
    void next.updateCallbackDone.catch(() => {});
    void next.finished.then(clear, clear);
  }, [animateEntry]);

  return { main, navigate };
}
