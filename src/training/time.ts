import { useEffect, useEffectEvent, useLayoutEffect, useRef, useState, useSyncExternalStore } from 'react';
import { getTelegram } from '../platform/telegram';

let pageHidden = false;
let telegramInactive = false;
const listeners = new Set<() => void>();
let disconnect: (() => void) | undefined;

function foreground() {
  return !pageHidden && !telegramInactive && !document.hidden && getTelegram()?.isActive !== false;
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  if (listeners.size === 1) {
    const notify = () => listeners.forEach((callback) => callback());
    const hide = () => { pageHidden = true; notify(); };
    const show = () => { pageHidden = false; notify(); };
    const suspend = () => { telegramInactive = true; notify(); };
    const activate = () => { telegramInactive = false; notify(); };
    const app = getTelegram();
    telegramInactive = app?.isActive === false;
    window.addEventListener('pagehide', hide);
    window.addEventListener('pageshow', show);
    document.addEventListener('visibilitychange', notify);
    app?.onEvent('deactivated', suspend);
    app?.onEvent('activated', activate);
    disconnect = () => {
      window.removeEventListener('pagehide', hide);
      window.removeEventListener('pageshow', show);
      document.removeEventListener('visibilitychange', notify);
      app?.offEvent('deactivated', suspend);
      app?.offEvent('activated', activate);
      pageHidden = false;
      telegramInactive = false;
    };
  }
  return () => {
    listeners.delete(listener);
    if (!listeners.size) disconnect?.();
  };
}

export function useTrainingForeground() {
  return useSyncExternalStore(subscribe, foreground);
}

export function useTrainingClock(initial: number, running: boolean) {
  const active = useTrainingForeground();
  const [clock] = useState(() => {
    let elapsed = initial;
    let started: number | null = null;
    return {
      elapsed: () => elapsed + (started === null ? 0 : performance.now() - started),
      start: () => { if (started === null) started = performance.now(); },
      stop: () => {
        if (started !== null) elapsed += performance.now() - started;
        started = null;
      },
      reset: () => { elapsed = 0; if (started !== null) started = performance.now(); },
    };
  });

  useLayoutEffect(() => {
    if (active && running) clock.start();
    return clock.stop;
  }, [active, running, clock]);
  return clock;
}

export function useTrainingDelay(delay: number | null, onEnd: () => void, phase: unknown) {
  const active = useTrainingForeground();
  const callback = useEffectEvent(onEnd);
  const pending = useRef({ phase, delay, remaining: delay });
  useLayoutEffect(() => {
    if (pending.current.phase !== phase || pending.current.delay !== delay) {
      pending.current = { phase, delay, remaining: delay };
    }
    const timer = pending.current;
    if (!active || timer.remaining === null) return;
    const started = performance.now();
    const id = window.setTimeout(() => {
      timer.remaining = null;
      callback();
    }, Math.ceil(timer.remaining));
    return () => {
      window.clearTimeout(id);
      if (timer.remaining !== null) timer.remaining = Math.max(0, timer.remaining - (performance.now() - started));
    };
  }, [delay, phase, active]);
}

// Tick only the text that shows time. The game board has no periodic renders.
export function useTrainingDisplay(elapsed: () => number, running: boolean) {
  const active = useTrainingForeground();
  const [value, setValue] = useState(elapsed);
  const tick = useEffectEvent(() => setValue(elapsed()));
  useEffect(() => {
    tick();
    if (!active || !running) return;
    const id = window.setInterval(tick, 100);
    return () => window.clearInterval(id);
  }, [active, running, elapsed]);
  return value;
}
