const key = 'aniseeker:stroop:sound:v1';
const notes = {
  tap: [390],
  correct: [580, 770],
  wrong: [290, 215],
  finish: [440, 554, 660],
} as const;

export function readSound() {
  try { return localStorage.getItem(key) !== 'off'; } catch { return true; }
}

export function storeSound(enabled: boolean) {
  try { localStorage.setItem(key, enabled ? 'on' : 'off'); } catch { /* Storage may be blocked. */ }
}

export function createSound() {
  let context: AudioContext | undefined;

  function unlock() {
    const Audio = window.AudioContext ?? (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Audio) return;
    try {
      context ??= new Audio();
      if (context.state !== 'running') void context.resume().catch(() => {});
    } catch { /* The WebView may prohibit audio. */ }
  }

  return {
    unlock,
    play(cue: keyof typeof notes) {
      if (!context || context.state !== 'running') return;
      const audio = context;
      const start = audio.currentTime;
      notes[cue].forEach((frequency, index) => {
        const at = start + index * .07;
        const oscillator = audio.createOscillator();
        const volume = audio.createGain();
        oscillator.frequency.value = frequency;
        volume.gain.setValueAtTime(.001, at);
        volume.gain.exponentialRampToValueAtTime(.075, at + .012);
        volume.gain.exponentialRampToValueAtTime(.001, at + .095);
        oscillator.connect(volume).connect(audio.destination);
        oscillator.onended = () => { oscillator.disconnect(); volume.disconnect(); };
        oscillator.start(at);
        oscillator.stop(at + .1);
      });
    },
    close() {
      if (context) void context.close().catch(() => {});
      context = undefined;
    },
  };
}
