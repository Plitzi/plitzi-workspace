import { getControl, setControl } from './arcadeControls';

// Tiny zero-asset sound bank built on the Web Audio API — short synthesized blips for the arcade. The context is
// created lazily and resumed on the first user gesture (browsers require it), so nothing plays until the visitor
// interacts. The mute flag lives on the Nexus controls store like every other toggle.
let ctx: AudioContext | null = null;

const ensure = (): AudioContext | null => {
  if (typeof window === 'undefined') {
    return null;
  }

  if (!ctx) {
    const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) {
      return null;
    }

    ctx = new Ctor();
  }

  return ctx;
};

export const resumeAudio = () => {
  const ac = ensure();
  if (ac && ac.state === 'suspended') {
    void ac.resume();
  }
};

export const setMuted = (value: boolean) => setControl('muted', value);

export const isMuted = () => getControl('muted');

const tone = (freq: number, dur: number, type: OscillatorType, vol: number, slideTo?: number) => {
  if (getControl('muted')) {
    return;
  }

  const ac = ensure();
  if (!ac || ac.state !== 'running') {
    return;
  }

  const osc = ac.createOscillator();
  const gain = ac.createGain();
  const t = ac.currentTime;
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t);
  if (slideTo !== undefined) {
    osc.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
  }

  gain.gain.setValueAtTime(vol, t);
  gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  osc.connect(gain);
  gain.connect(ac.destination);
  osc.start(t);
  osc.stop(t + dur);
};

export const sfx = {
  shoot: () => tone(660, 0.07, 'square', 0.018, 320),
  hit: () => tone(240, 0.1, 'sawtooth', 0.04),
  explode: () => tone(110, 0.32, 'sawtooth', 0.05, 40),
  bounce: () => tone(420, 0.05, 'sine', 0.03),
  power: () => {
    tone(720, 0.1, 'triangle', 0.045, 1100);
    window.setTimeout(() => tone(1180, 0.12, 'triangle', 0.04), 70);
  },
  hurt: () => tone(160, 0.3, 'square', 0.05, 60),
  move: () => tone(360, 0.05, 'sine', 0.025),
  undo: () => tone(520, 0.09, 'triangle', 0.035, 300)
};
