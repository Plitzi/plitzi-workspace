import type { ReactionEmoji } from '../../board/reactions.ts';

/**
 * What a board sounds like: short, soft cues for what happens on it — one's own actions, as a confirmation under the
 * hand (a note put down, a card ticked, an arrow connected, something removed), and the moments the others make
 * (somebody arriving, a line in the chat, a reaction, a comment, a vote, a timer starting and running out).
 *
 * Synthesised with Web Audio — notes, chords, glides and filtered noise — so there is nothing to load, and quiet
 * enough to stay in the background of a conversation. A browser lets a page make sound only after the person has
 * touched it; until then every cue is silently skipped.
 */

export const SOUNDS = [
  'join',
  'leave',
  'message',
  'sent',
  'summon',
  'present',
  'follow',
  'timerStart',
  'tick',
  'timer',
  'timerStop',
  'presentStart',
  'presentEnd',
  'unfollow',
  'draw',
  'group',
  'layer',
  'style',
  'tidy',
  'copy',
  'laser',
  'camera',
  'lock',
  'place',
  'connect',
  'snap',
  'remove',
  'undo',
  'done',
  'undone',
  'vote',
  'comment',
  'reply',
  'resolve',
  'thumbs',
  'heart',
  'party',
  'laugh',
  'fire',
  'eyes',
  'check',
  'question',
  'clap',
  'idea',
  'hmm',
  'rocket'
] as const;

export type Sound = (typeof SOUNDS)[number];

export const isSound = (value: unknown): value is Sound => SOUNDS.some(sound => sound === value);

/** Each reaction has a voice of its own: a party is not a question. */
export const REACTION_SOUNDS: Record<ReactionEmoji, Sound> = {
  '👍': 'thumbs',
  '❤️': 'heart',
  '🎉': 'party',
  '😂': 'laugh',
  '🔥': 'fire',
  '👀': 'eyes',
  '✅': 'check',
  '❓': 'question',
  '👏': 'clap',
  '💡': 'idea',
  '🤔': 'hmm',
  '🚀': 'rocket'
};

/** One note: a pitch that may glide or wobble, an envelope, a wave. */
type Tone = {
  kind: 'tone';
  at: number;
  from: number;
  to?: number;
  /** A vibrato this many hertz wide, four times a second — a laugh's wobble. */
  wobble?: number;
  length: number;
  wave: OscillatorType;
  volume: number;
};

/** A breath of noise through a band that moves: paper, a swish, a crackle. */
type Noise = { kind: 'noise'; at: number; from: number; to: number; q: number; length: number; volume: number };

type Part = Tone | Noise;

const tone = (at: number, from: number, length: number, volume: number, more: Partial<Tone> = {}): Tone => ({
  kind: 'tone',
  at,
  from,
  length,
  volume,
  wave: 'sine',
  ...more
});

const noise = (at: number, from: number, to: number, length: number, volume: number, q = 1.2): Noise => ({
  kind: 'noise',
  at,
  from,
  to,
  q,
  length,
  volume
});

/** Notes by name, in hertz: what the cues below are written with. */
const C5 = 523;
const G5 = 784;
const A5 = 880;
const C6 = 1047;
const E6 = 1319;
const G6 = 1568;

const CUES: Record<Sound, readonly Part[]> = {
  // Arrivals and departures: two notes up, two notes down.
  join: [tone(0, C6, 0.14, 0.05), tone(0.11, E6, 0.2, 0.05)],
  leave: [tone(0, E6, 0.12, 0.035), tone(0.1, C6, 0.18, 0.035)],
  // A line to read; one's own, sent off.
  message: [tone(0, A5, 0.12, 0.06, { to: 640 })],
  sent: [noise(0, 900, 3200, 0.12, 0.03, 2), tone(0.02, 700, 0.08, 0.025, { to: 1200 })],
  // The view moving to somebody else's; a presentation moving on; following someone.
  summon: [noise(0, 300, 2400, 0.42, 0.08, 1.4)],
  present: [tone(0, 660, 0.07, 0.05, { wave: 'triangle' })],
  follow: [tone(0, G5, 0.09, 0.04), tone(0.07, C6, 0.12, 0.04)],
  // A timer: a bright start, a tick for each of its last seconds, three bells at the end.
  timerStart: [
    tone(0, C5, 0.12, 0.05, { wave: 'triangle' }),
    tone(0.1, G5, 0.12, 0.05, { wave: 'triangle' }),
    tone(0.2, C6, 0.3, 0.06, { wave: 'triangle' })
  ],
  tick: [tone(0, 1800, 0.03, 0.04, { wave: 'square' })],
  timer: [0, 0.28, 0.56].map(at => tone(at, G6, 0.5, 0.07, { wave: 'triangle' })),
  // Stopped before its end: the start, played back down.
  timerStop: [
    tone(0, C6, 0.1, 0.05, { wave: 'triangle' }),
    tone(0.09, G5, 0.1, 0.05, { wave: 'triangle' }),
    tone(0.18, C5, 0.22, 0.05, { wave: 'triangle' })
  ],
  // A presentation opening: the same bright rise as a timer's start, a little lower.
  presentStart: [
    tone(0, G5 / 2, 0.1, 0.05, { wave: 'triangle' }),
    tone(0.09, C5, 0.1, 0.05, { wave: 'triangle' }),
    tone(0.18, G5, 0.28, 0.06, { wave: 'triangle' })
  ],
  presentEnd: [tone(0, 660, 0.08, 0.045, { wave: 'triangle' }), tone(0.08, 440, 0.14, 0.045, { wave: 'triangle' })],
  unfollow: [tone(0, C6, 0.08, 0.035), tone(0.06, G5, 0.12, 0.035)],
  // A stroke of the pen, lifted: pencil on paper.
  draw: [noise(0, 2200, 3600, 0.1, 0.035, 2.5)],
  group: [tone(0, 600, 0.05, 0.045, { wave: 'triangle' }), tone(0.04, 900, 0.07, 0.045, { wave: 'triangle' })],
  layer: [tone(0, 1400, 0.035, 0.035, { wave: 'triangle' })],
  style: [tone(0, 1100, 0.03, 0.03, { wave: 'sine' })],
  tidy: [0, 0.05, 0.1, 0.15].map((at, index) => tone(at, 700 + index * 180, 0.05, 0.035, { wave: 'triangle' })),
  copy: [tone(0, 1300, 0.04, 0.035, { wave: 'triangle' }), tone(0.05, 1300, 0.04, 0.035, { wave: 'triangle' })],
  laser: [tone(0, 1800, 0.12, 0.025, { to: 2600, wave: 'sawtooth' })],
  // A shutter: the board, saved as a picture.
  camera: [noise(0, 3000, 1500, 0.05, 0.08, 1.5), noise(0.08, 2500, 1200, 0.06, 0.06, 1.5)],
  lock: [tone(0, 300, 0.06, 0.06, { wave: 'square', to: 200 }), noise(0.03, 1800, 900, 0.06, 0.05, 2)],
  // Under the hand: a note put down, an arrow clicking into place, a card dropped in a column, something taken away.
  place: [noise(0, 1400, 500, 0.09, 0.07, 0.8), tone(0, 220, 0.07, 0.04, { to: 140 })],
  connect: [tone(0, 1200, 0.04, 0.045, { wave: 'triangle' }), tone(0.045, 1600, 0.05, 0.04, { wave: 'triangle' })],
  snap: [tone(0, 900, 0.05, 0.05, { wave: 'triangle', to: 1300 }), noise(0, 2500, 4000, 0.04, 0.03, 3)],
  remove: [noise(0, 2600, 500, 0.18, 0.05, 1.6), tone(0, 500, 0.14, 0.03, { to: 220 })],
  undo: [tone(0, 900, 0.08, 0.035, { to: 520 })],
  // A task: done is a bright two-note ding; not done any more, the same falling.
  done: [tone(0, E6, 0.1, 0.05), tone(0.08, G6, 0.28, 0.05)],
  undone: [tone(0, G6, 0.08, 0.035), tone(0.07, E6, 0.14, 0.035)],
  // Reviews: a vote plucked up, a comment's bubble, an answer, a thread resolved.
  vote: [tone(0, 520, 0.1, 0.055, { wave: 'triangle', to: 1040 })],
  comment: [tone(0, 700, 0.06, 0.05, { to: 1100 }), tone(0.07, 1100, 0.1, 0.04)],
  reply: [tone(0, 950, 0.07, 0.04, { to: 1250 })],
  resolve: [tone(0, C6, 0.1, 0.045), tone(0.08, E6, 0.1, 0.045), tone(0.16, G6, 0.22, 0.045)],
  // The reactions, each its own.
  thumbs: [tone(0, 440, 0.09, 0.06, { wave: 'triangle', to: 880 })],
  heart: [tone(0, A5, 0.35, 0.045), tone(0, C6 * 1.25, 0.35, 0.03)],
  party: [
    noise(0, 3000, 7000, 0.3, 0.05, 0.7),
    tone(0.02, C6, 0.25, 0.035),
    tone(0.06, E6, 0.25, 0.035),
    tone(0.1, G6, 0.3, 0.035)
  ],
  laugh: [0, 0.11, 0.22].map(at => tone(at, 620 - at * 400, 0.09, 0.05, { wave: 'triangle', wobble: 60 })),
  fire: [noise(0, 400, 1800, 0.35, 0.08, 0.6), noise(0.05, 2500, 900, 0.25, 0.04, 2)],
  eyes: [tone(0, 1200, 0.05, 0.045), tone(0.12, 1200, 0.05, 0.045)],
  check: [tone(0, E6, 0.08, 0.05), tone(0.07, G6 * 1.33, 0.2, 0.05)],
  question: [tone(0, 500, 0.22, 0.05, { to: 900 })],
  // Hands together, a few times; a bulb lighting; a low wondering wobble; a launch rising away.
  clap: [0, 0.13, 0.26, 0.36].map(at => noise(at, 1200, 2600, 0.06, 0.09, 1.1)),
  idea: [tone(0, G6, 0.06, 0.04), tone(0.06, C6 * 2, 0.26, 0.045)],
  hmm: [tone(0, 260, 0.4, 0.05, { wave: 'triangle', wobble: 18, to: 220 })],
  rocket: [noise(0, 300, 3200, 0.55, 0.07, 0.9), tone(0.05, 300, 0.5, 0.03, { to: 1400, wave: 'sawtooth' })]
};

/**
 * How loud the cues are, over the levels they are written at: clearly heard over a call, and pressed by a compressor
 * so a chord or a burst of them never clips.
 */
const MASTER = 3.2;

/** The same cue at most this often: a burst of reactions is one bubble, not a machine gun. */
const GAP_MS = 120;

export const createSounds = () => {
  let context: AudioContext | undefined;
  /** Where every cue goes: the master level, then the compressor, then the speakers. */
  let bus: AudioNode | undefined;

  const outputOf = (output: AudioContext): AudioNode => {
    if (!bus) {
      const master = output.createGain();
      const compressor = output.createDynamicsCompressor();
      master.gain.value = MASTER;
      compressor.threshold.value = -12;
      compressor.ratio.value = 6;
      master.connect(compressor).connect(output.destination);
      bus = master;
    }

    return bus;
  };
  let enabled = true;
  const last = new Map<Sound, number>();

  /** Made — or woken — on the person's first touch or key: the one moment a browser lets a page start its sound. */
  const unlock = (): void => {
    if (typeof window.AudioContext !== 'function') {
      return;
    }

    context ??= new window.AudioContext();
    if (context.state === 'suspended') {
      void context.resume().catch(() => undefined);
    }
  };
  window.addEventListener('pointerdown', unlock);
  window.addEventListener('keydown', unlock);

  const playTone = (
    output: AudioContext,
    start: number,
    { at, from, to, wobble, length, wave, volume }: Tone
  ): void => {
    const oscillator = output.createOscillator();
    const gain = output.createGain();
    oscillator.type = wave;
    oscillator.frequency.setValueAtTime(from, start + at);
    if (to) {
      oscillator.frequency.exponentialRampToValueAtTime(to, start + at + length);
    }

    if (wobble) {
      const lfo = output.createOscillator();
      const depth = output.createGain();
      lfo.frequency.value = 24;
      depth.gain.value = wobble;
      lfo.connect(depth).connect(oscillator.frequency);
      lfo.start(start + at);
      lfo.stop(start + at + length + 0.02);
    }

    gain.gain.setValueAtTime(0.0001, start + at);
    gain.gain.exponentialRampToValueAtTime(volume, start + at + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + at + length);
    oscillator.connect(gain).connect(outputOf(output));
    oscillator.start(start + at);
    oscillator.stop(start + at + length + 0.02);
  };

  const playNoise = (output: AudioContext, start: number, { at, from, to, q, length, volume }: Noise): void => {
    const buffer = output.createBuffer(1, Math.ceil(output.sampleRate * length), output.sampleRate);
    const samples = buffer.getChannelData(0);
    for (let index = 0; index < samples.length; index += 1) {
      samples[index] = Math.random() * 2 - 1;
    }

    const source = output.createBufferSource();
    const filter = output.createBiquadFilter();
    const gain = output.createGain();
    source.buffer = buffer;
    filter.type = 'bandpass';
    filter.Q.value = q;
    filter.frequency.setValueAtTime(from, start + at);
    filter.frequency.exponentialRampToValueAtTime(to, start + at + length);
    gain.gain.setValueAtTime(0.0001, start + at);
    gain.gain.exponentialRampToValueAtTime(volume, start + at + Math.min(0.06, length / 3));
    gain.gain.exponentialRampToValueAtTime(0.0001, start + at + length);
    source.connect(filter).connect(gain).connect(outputOf(output));
    source.start(start + at);
  };

  return {
    play: (sound: Sound): void => {
      const now = Date.now();
      const output = context?.state === 'running' ? context : undefined;
      if (!enabled || !output || now - (last.get(sound) ?? 0) < GAP_MS) {
        return;
      }

      last.set(sound, now);
      const start = output.currentTime;
      for (const part of CUES[sound]) {
        if (part.kind === 'tone') {
          playTone(output, start, part);
        } else {
          playNoise(output, start, part);
        }
      }
    },
    setEnabled: (next: boolean): void => {
      enabled = next;
    },
    close: (): void => {
      window.removeEventListener('pointerdown', unlock);
      window.removeEventListener('keydown', unlock);
      void context?.close().catch(() => undefined);
      context = undefined;
      bus = undefined;
    }
  };
};

export type Sounds = ReturnType<typeof createSounds>;
