/**
 * Web Audio API synthesizer for Focus Assistant sound feedback.
 * Pure code synthesis, 0 external audio files, 0 latency.
 */

let audioCtx: AudioContext | null = null;

async function ensureAudioContext(): Promise<AudioContext | null> {
  if (typeof window === "undefined") return null;

  try {
    if (!audioCtx || audioCtx.state === "closed") {
      const AudioContextClass =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AudioContextClass) return null;
      audioCtx = new AudioContextClass();
    }

    if (audioCtx.state === "suspended") {
      await audioCtx.resume();
    }
    return audioCtx;
  } catch (err) {
    console.warn("AudioContext initialization warning:", err);
    return null;
  }
}

const SOUND_PREF_KEY = "workbuddy.sound_enabled";

export function isSoundEnabled(): boolean {
  if (typeof window === "undefined") return true;
  const val = localStorage.getItem(SOUND_PREF_KEY);
  return val === null ? true : val === "true";
}

export function setSoundEnabled(enabled: boolean): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(SOUND_PREF_KEY, String(enabled));
}

/**
 * Play victory fanfare when focus session completes
 */
export async function playVictorySound(isPixelTheme = false): Promise<void> {
  if (!isSoundEnabled()) return;
  const ctx = await ensureAudioContext();
  if (!ctx) return;

  const now = ctx.currentTime;

  if (isPixelTheme) {
    // 8-bit retro victory fanfare: C5 -> E5 -> G5 -> C6 (Square wave)
    const notes = [523.25, 659.25, 783.99, 1046.5]; // C5, E5, G5, C6
    notes.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = "square";
      osc.frequency.setValueAtTime(freq, now + i * 0.09);

      gain.gain.setValueAtTime(0.16, now + i * 0.09);
      gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.09 + 0.18);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now + i * 0.09);
      osc.stop(now + i * 0.09 + 0.2);
    });
  } else {
    // Modern warm chord chime: Marimba / Crystal Bell (Sine + Triangle combination)
    const freqs = [523.25, 659.25, 783.99, 1046.5];
    freqs.forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = idx % 2 === 0 ? "sine" : "triangle";
      osc.frequency.setValueAtTime(freq, now + idx * 0.08);

      gain.gain.setValueAtTime(0.22, now + idx * 0.08);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + idx * 0.08 + 0.7);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now + idx * 0.08);
      osc.stop(now + idx * 0.08 + 0.75);
    });
  }
}

/**
 * Play gentle chime when rest session completes
 */
export async function playRestEndSound(isPixelTheme = false): Promise<void> {
  if (!isSoundEnabled()) return;
  const ctx = await ensureAudioContext();
  if (!ctx) return;

  const now = ctx.currentTime;

  if (isPixelTheme) {
    // 8-bit energetic morning fanfare: C5 -> G5 -> C6 -> E6 (Square wave)
    const notes = [523.25, 783.99, 1046.5, 1318.51];
    notes.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = "square";
      osc.frequency.setValueAtTime(freq, now + i * 0.1);

      gain.gain.setValueAtTime(0.16, now + i * 0.1);
      gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.1 + 0.22);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now + i * 0.1);
      osc.stop(now + i * 0.1 + 0.24);
    });
  } else {
    // Crisp morning crystal bell sequence: F5 -> A5 -> C6 -> F6
    const freqs = [698.46, 880.0, 1046.5, 1396.91]; // F5, A5, C6, F6
    freqs.forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = idx % 2 === 0 ? "sine" : "triangle";
      osc.frequency.setValueAtTime(freq, now + idx * 0.1);

      gain.gain.setValueAtTime(0.22, now + idx * 0.1);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + idx * 0.1 + 0.8);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now + idx * 0.1);
      osc.stop(now + idx * 0.1 + 0.85);
    });
  }
}

/**
 * Play cute chirp on pet poke interaction
 */
export async function playPokeSound(isPixelTheme = false): Promise<void> {
  if (!isSoundEnabled()) return;
  const ctx = await ensureAudioContext();
  if (!ctx) return;

  const now = ctx.currentTime;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();

  if (isPixelTheme) {
    osc.type = "square";
    osc.frequency.setValueAtTime(880, now);
    osc.frequency.exponentialRampToValueAtTime(1320, now + 0.08);
    gain.gain.setValueAtTime(0.12, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.1);
  } else {
    osc.type = "sine";
    osc.frequency.setValueAtTime(600, now);
    osc.frequency.exponentialRampToValueAtTime(900, now + 0.1);
    gain.gain.setValueAtTime(0.15, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);
  }

  osc.connect(gain);
  gain.connect(ctx.destination);

  osc.start(now);
  osc.stop(now + 0.13);
}

/**
 * Play pleasant alert chime when a task reminder triggers
 */
export async function playTaskReminderSound(isPixelTheme = false): Promise<void> {
  if (!isSoundEnabled()) return;
  const ctx = await ensureAudioContext();
  if (!ctx) return;

  const now = ctx.currentTime;

  if (isPixelTheme) {
    // 8-bit retro alert chime: E5 -> A5 -> C#6 (Square wave)
    const notes = [659.25, 880.0, 1108.73];
    notes.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = "square";
      osc.frequency.setValueAtTime(freq, now + i * 0.08);

      gain.gain.setValueAtTime(0.18, now + i * 0.08);
      gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.08 + 0.2);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now + i * 0.08);
      osc.stop(now + i * 0.08 + 0.22);
    });
  } else {
    // Modern crystal alert bell: Dual chord chime
    const chord1 = [659.25, 987.77]; // E5, B5
    const chord2 = [830.61, 1318.51]; // G#5, E6

    chord1.forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = idx === 0 ? "sine" : "triangle";
      osc.frequency.setValueAtTime(freq, now);

      gain.gain.setValueAtTime(0.2, now);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.5);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now);
      osc.stop(now + 0.55);
    });

    chord2.forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = idx === 0 ? "sine" : "triangle";
      osc.frequency.setValueAtTime(freq, now + 0.12);

      gain.gain.setValueAtTime(0.24, now + 0.12);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.12 + 0.9);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now + 0.12);
      osc.stop(now + 0.12 + 0.95);
    });
  }
}
