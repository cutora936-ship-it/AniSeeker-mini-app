import type { UserStorage } from '../account/storage';
import receive from '../assets/communication/sounds/receive.wav?no-inline';
import send from '../assets/communication/sounds/send.wav?no-inline';
import tap from '../assets/communication/sounds/tap.wav?no-inline';
import chapter from '../assets/communication/sounds/chapter.wav?no-inline';

const urls = { receive, send, tap, chapter };
export type Sound = keyof typeof urls;
const preference = 'aniseeker:communication:sound';

export function readSound(storage: UserStorage) {
  try { return storage.getItem(preference) !== 'off'; } catch { return true; }
}

export function writeSound(storage: UserStorage, enabled: boolean) {
  try { storage.setItem(preference, enabled ? 'on' : 'off'); } catch { /* Browser storage may be blocked. */ }
}

export function createAudio() {
  let context: AudioContext | undefined;
  let ready: Promise<void> | undefined;
  const buffers = new Map<Sound, AudioBuffer>();
  const playing = new Set<AudioBufferSourceNode>();
  let pending: Sound | undefined;

  function play(sound: Sound) {
    const buffer = buffers.get(sound);
    if (!context || context.state !== 'running' || !buffer) {
      if (context && !buffer) pending = sound;
      return;
    }
    const source = context.createBufferSource();
    source.buffer = buffer;
    source.connect(context.destination);
    playing.add(source);
    source.onended = () => {
      playing.delete(source);
      source.disconnect();
    };
    source.start();
  }

  function unlock() {
    const Context = window.AudioContext ?? (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Context) return;
    try {
      context ??= new Context();
      const active = context;
      if (active.state !== 'running') void active.resume().catch(() => {});
      ready ??= Promise.all((Object.keys(urls) as Sound[]).map(async (sound) => {
        try {
          const response = await fetch(urls[sound]);
          if (!response.ok || context !== active) return;
          const buffer = await active.decodeAudioData(await response.arrayBuffer());
          if (context === active) buffers.set(sound, buffer);
        } catch { /* A sound failure should not stop the story. */ }
      })).then(() => {
        if (context !== active || !pending) return;
        const sound = pending;
        pending = undefined;
        play(sound);
      });
    } catch { /* The WebView may prohibit audio. */ }
  }

  function stop() {
    pending = undefined;
    for (const source of playing) source.stop();
    playing.clear();
  }

  return { unlock, play, stop, close() {
    stop();
    if (context) void context.close().catch(() => {});
    context = undefined;
    ready = undefined;
    buffers.clear();
  } };
}
