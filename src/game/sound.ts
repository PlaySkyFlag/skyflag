// Tiny Web Audio synth — no audio files, all tones generated at runtime.
// Each "sound" is one or a short sequence of oscillator tones with a brief
// attack/decay envelope. Browsers (especially iOS Safari) require the
// AudioContext to start from a user gesture, so we lazily create it on
// first sound trigger — every game action is initiated by a user click,
// so the context begins in an unblocked state.

const SOUND_KEY = '3phor.sound.muted';

let audioCtx: AudioContext | null = null;
let muted = readMutedFromStorage();

function readMutedFromStorage(): boolean {
  try {
    return localStorage.getItem(SOUND_KEY) === '1';
  } catch {
    return false;
  }
}

function getCtx(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  if (!audioCtx) {
    const Ctx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext })
        .webkitAudioContext;
    if (!Ctx) return null;
    try {
      audioCtx = new Ctx();
    } catch {
      return null;
    }
  }
  const ctx = audioCtx;
  if (ctx.state === 'suspended') {
    // Best-effort resume; will succeed when called from a user-gesture
    // handler (which all game actions are).
    ctx.resume().catch(() => {
      /* ignore */
    });
  }
  return ctx;
}

// Play a single tone with a quick attack and exponential decay.
function tone(
  freq: number,
  durationMs: number,
  type: OscillatorType = 'sine',
  volume = 0.12,
  delayMs = 0,
): void {
  const ctx = getCtx();
  if (!ctx) return;

  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = type;
  osc.frequency.value = freq;
  osc.connect(gain);
  gain.connect(ctx.destination);

  const start = ctx.currentTime + delayMs / 1000;
  gain.gain.setValueAtTime(0, start);
  gain.gain.linearRampToValueAtTime(volume, start + 0.005);
  gain.gain.exponentialRampToValueAtTime(0.0001, start + durationMs / 1000);

  osc.start(start);
  osc.stop(start + durationMs / 1000 + 0.05);
}

// Public sound bank. Each function is a no-op when muted.
export const sounds = {
  move() {
    if (muted) return;
    tone(440, 70, 'sine', 0.08);
  },
  deploy() {
    if (muted) return;
    tone(196, 90, 'triangle', 0.12);
    tone(294, 120, 'triangle', 0.10, 60);
  },
  capture() {
    if (muted) return;
    tone(880, 50, 'square', 0.13);
    tone(330, 90, 'square', 0.10, 50);
  },
  lift() {
    if (muted) return;
    // Two-note "elevator ding" — ascending fifth.
    tone(523, 90, 'sine', 0.10);
    tone(784, 150, 'sine', 0.10, 80);
  },
  promotion() {
    if (muted) return;
    // Major triad arpeggio — C E G.
    tone(523, 110, 'triangle', 0.11);
    tone(659, 110, 'triangle', 0.11, 100);
    tone(784, 200, 'triangle', 0.12, 200);
  },
  win() {
    if (muted) return;
    // Short fanfare — C E G C8.
    tone(523, 140, 'triangle', 0.13);
    tone(659, 140, 'triangle', 0.13, 130);
    tone(784, 140, 'triangle', 0.13, 260);
    tone(1047, 280, 'triangle', 0.14, 390);
  },
  endTurn() {
    if (muted) return;
    tone(330, 80, 'sine', 0.05);
  },
};

export function isMuted(): boolean {
  return muted;
}

export function setMuted(value: boolean): void {
  muted = value;
  try {
    localStorage.setItem(SOUND_KEY, value ? '1' : '0');
  } catch {
    /* private mode etc — fine to lose the preference */
  }
}
