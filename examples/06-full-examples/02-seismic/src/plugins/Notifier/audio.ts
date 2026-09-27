/**
 * The instrument's voice: a sonar ping for a new event, and a lower double tone for one that damages buildings.
 *
 * Synthesised with Web Audio rather than played from a file — two oscillators and an envelope are less to ship than
 * any recording, and every pitch here is a choice somebody can read.
 *
 * A browser keeps a page silent until somebody has clicked or pressed a key on it. The context is created on the first
 * sound asked for and resumed on the first gesture, so a display that was touched once rings from then on; one that
 * nobody has touched since it was opened stays silent, whatever it is told.
 */

let context: AudioContext | undefined;

const audio = (): AudioContext | undefined => {
  if (typeof window === 'undefined' || typeof window.AudioContext !== 'function') {
    return undefined;
  }

  context ??= new window.AudioContext();

  return context;
};

const GESTURES = ['pointerdown', 'keydown'] as const;

/** Resumes the context on the next gesture — the one moment a browser lets a page start making sound. */
export const unlockOnGesture = (): (() => void) => {
  const unlock = (): void => {
    void audio()?.resume();
  };
  GESTURES.forEach(type => window.addEventListener(type, unlock, { passive: true }));

  return () => GESTURES.forEach(type => window.removeEventListener(type, unlock));
};

/** One tone: a glide from `from` to `to` hertz, struck and fading over `seconds`, starting `at` seconds from now. */
const tone = (sound: AudioContext, from: number, to: number, at: number, seconds: number, volume: number): void => {
  const start = sound.currentTime + at;
  const oscillator = sound.createOscillator();
  const gain = sound.createGain();
  oscillator.type = 'sine';
  oscillator.frequency.setValueAtTime(from, start);
  oscillator.frequency.exponentialRampToValueAtTime(to, start + seconds);
  gain.gain.setValueAtTime(0.0001, start);
  gain.gain.exponentialRampToValueAtTime(volume, start + 0.015);
  gain.gain.exponentialRampToValueAtTime(0.0001, start + seconds);
  oscillator.connect(gain).connect(sound.destination);
  oscillator.start(start);
  oscillator.stop(start + seconds + 0.05);
};

/** From this magnitude an arrival sounds the alarm rather than the ping — where buildings start to be damaged. */
export const ALARM_MAGNITUDE = 5;

/**
 * How long a suspended context is given to start. Right after a click it starts at once; with no gesture behind it,
 * `resume()` waits for the next one — and a ping played then would sound for an event long gone.
 */
const RESUME_WAIT_MS = 300;

const running = async (sound: AudioContext): Promise<boolean> => {
  if (sound.state !== 'running') {
    await Promise.race([sound.resume(), new Promise(resolve => setTimeout(resolve, RESUME_WAIT_MS))]);
  }

  return sound.state === 'running';
};

/** The sound of an arrival: a ping, or a two-tone alarm struck twice for a strong one. */
export const chime = async (magnitude: number): Promise<void> => {
  const sound = audio();
  if (!sound || !(await running(sound))) {
    return;
  }

  if (magnitude < ALARM_MAGNITUDE) {
    tone(sound, 1320, 880, 0, 0.7, 0.12);

    return;
  }

  [0, 0.42].forEach(at => {
    tone(sound, 660, 520, at, 0.36, 0.18);
    tone(sound, 440, 350, at, 0.36, 0.14);
  });
};
