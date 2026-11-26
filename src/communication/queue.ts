export type Phase = 'typing' | 'pause' | 'idle';

export function typingDelay(text: string, random = Math.random) {
  return Math.min(2500, Math.max(500, 470 + text.length * 12 + Math.round(random() * 260)));
}

export function afterDelivery(index: number, length: number): Phase {
  return index + 1 < length ? 'pause' : 'idle';
}

export function scheduleMessage(wait: number, action: () => void) {
  const timer = globalThis.setTimeout(action, wait);
  return () => globalThis.clearTimeout(timer);
}
