import {
  MOTION_DEFAULT_DURATION,
  MOTION_ENTER_EASING,
  MOTION_ENTER_FRAMES,
  MOTION_ENTERS,
  MOTION_LOOP_FRAMES,
  MOTION_LOOPS
} from '@plitzi/sdk-shared/schema/motion';

import type { ElementMotion, MotionEnter, MotionLoop, MotionTrigger } from '@plitzi/sdk-shared/schema/motion';

export type Timing = 'duration' | 'delay' | 'stagger';

/** What the fields hold while typed: the presets as chosen, the timings as written. */
export type Draft = { enter: string; on: string; loop: string } & Record<Timing, string>;

export type PresetKind = 'enter' | 'loop';

/** A preset as a person reads it: its name, what it looks like, and the words the summary says it with. */
export type PresetCopy = { label: string; hint: string; phrase: string };

export const ENTER_COPY: Record<MotionEnter, PresetCopy> = {
  fade: { label: 'Fade in', hint: 'Appears from transparent', phrase: 'fades in' },
  'fade-up': { label: 'Rise', hint: 'Fades in, rising a little', phrase: 'rises into place' },
  'fade-down': { label: 'Drop', hint: 'Fades in, coming down a little', phrase: 'drops into place' },
  'slide-left': { label: 'From the right', hint: 'Fades in, sliding left', phrase: 'slides in from the right' },
  'slide-right': { label: 'From the left', hint: 'Fades in, sliding right', phrase: 'slides in from the left' },
  'slide-up': { label: 'Slide up', hint: 'Comes up from well below', phrase: 'slides up into place' },
  scale: { label: 'Grow', hint: 'Fades in, growing slightly', phrase: 'grows into place' },
  'zoom-in': { label: 'Zoom in', hint: 'Grows from small, all the way', phrase: 'zooms in' },
  'zoom-out': { label: 'Zoom out', hint: 'Settles from larger than it is', phrase: 'settles from larger' },
  pop: { label: 'Pop', hint: 'Grows past its size and settles back', phrase: 'pops into place' },
  'bounce-in': { label: 'Bounce in', hint: 'Falls into place and bounces', phrase: 'bounces into place' },
  tilt: { label: 'Tilt in', hint: 'Rises, turning straight as it lands', phrase: 'tilts into place' },
  'spin-in': { label: 'Spin in', hint: 'Turns half round as it grows in', phrase: 'spins into place' }
};

export const LOOP_COPY: Record<MotionLoop, PresetCopy> = {
  float: { label: 'Float', hint: 'Rises and settles, slowly', phrase: 'floats gently' },
  pulse: { label: 'Pulse', hint: 'Grows a touch and back, like a breath', phrase: 'breathes' },
  spin: { label: 'Spin', hint: 'Turns round, once every 12 s', phrase: 'keeps turning' },
  sway: { label: 'Sway', hint: 'Tilts side to side', phrase: 'sways side to side' },
  bounce: { label: 'Bounce', hint: 'Hops and lands, squashing a little', phrase: 'keeps bouncing' },
  wobble: { label: 'Wobble', hint: 'Rocks one way and the other', phrase: 'wobbles' },
  orbit: { label: 'Orbit', hint: 'Circles round where it is, slowly', phrase: 'circles slowly' },
  heartbeat: { label: 'Heartbeat', hint: 'Two quick beats, then a rest', phrase: 'beats like a heart' },
  drift: { label: 'Drift', hint: 'Drifts sideways and back', phrase: 'drifts side to side' }
};

export const ARRIVES_NONE: PresetCopy = {
  label: 'Already there',
  hint: 'It is in place from the first paint',
  phrase: ''
};

export const LOOP_NONE: PresetCopy = { label: 'Stays still', hint: 'It stays where it arrived', phrase: '' };

export const TRIGGER_COPY: Record<MotionTrigger, { label: string; hint: string }> = {
  load: { label: 'On load', hint: 'As soon as the page is shown, with the timing below.' },
  view: {
    label: 'In view',
    hint: 'Once, the first time the reader scrolls to it, with the timing below — then it stays.'
  },
  scroll: {
    label: 'With scroll',
    hint: 'With the scroll itself, at the reader’s pace — fully in a third of the way into view, and back out as they scroll up past it. A browser that cannot follow the scroll plays it on load, with the timing below.'
  }
};

/** When it arrives, as the summary says it. */
const TRIGGER_PHRASE: Record<MotionTrigger, string> = {
  load: 'as the page loads',
  view: 'once, as it comes into view',
  scroll: 'with the scroll'
};

/** The gap a person gets on asking for children one by one, before they say another. */
export const DEFAULT_STAGGER = 80;

export const draftOf = (motion: ElementMotion | undefined): Draft => ({
  enter: motion?.enter ?? '',
  on: motion?.on ?? 'load',
  loop: motion?.loop ?? '',
  duration: motion?.duration === undefined ? '' : String(motion.duration),
  delay: motion?.delay === undefined ? '' : String(motion.delay),
  stagger: motion?.stagger === undefined ? '' : String(motion.stagger)
});

/** The draft as a motion: the fields left empty are left out, and `on` only beside an arrival it times. */
export const motionOf = (draft: Draft): Record<string, unknown> => {
  const timing = (value: string): number | undefined => (value.trim() === '' ? undefined : Number(value));
  const entries: [string, unknown][] = [
    ['enter', draft.enter || undefined],
    ['on', draft.enter && draft.on !== 'load' ? draft.on : undefined],
    ['duration', timing(draft.duration)],
    ['delay', timing(draft.delay)],
    ['stagger', timing(draft.stagger)],
    ['loop', draft.loop || undefined]
  ];

  return Object.fromEntries(entries.filter(([, value]) => value !== undefined));
};

const ms = (value: number): string => (value >= 1000 ? `${String(value / 1000)} s` : `${String(value)} ms`);

/** What the element will do, in one or two sentences — what a person checks their choices against. */
export const describeMotion = (motion: ElementMotion): string => {
  const sentences: string[] = [];
  if (motion.enter) {
    const subject = motion.stagger === undefined ? 'It' : 'Each child';
    const parts = [`${subject} ${ENTER_COPY[motion.enter].phrase}`];
    if (motion.stagger !== undefined) {
      parts.push(motion.on === 'scroll' ? 'one after another' : `one after another, ${ms(motion.stagger)} apart`);
    }

    parts.push(TRIGGER_PHRASE[motion.on ?? 'load']);
    if (motion.on !== 'scroll') {
      const timing = [`over ${ms(motion.duration ?? MOTION_DEFAULT_DURATION)}`];
      if (motion.delay) {
        timing.push(`after waiting ${ms(motion.delay)}`);
      }

      parts.push(timing.join(', '));
    }

    sentences.push(`${parts.join(', ')}.`);
  }

  if (motion.loop) {
    const subject = motion.enter ? 'Then it' : 'It';
    sentences.push(`${subject} ${LOOP_COPY[motion.loop].phrase} for as long as the page is open.`);
  }

  return sentences.join(' ');
};

/** How long a preview waits before it plays again while hovered: long enough to see where it ended. */
const PREVIEW_REST_MS = 700;

/**
 * How much stronger a loop is played on the stage than on the page. A loop is meant to be barely noticed — 8 px of
 * float, 4% of pulse, 2° of sway — and on a card a few dozen pixels wide that reads as nothing at all.
 */
export const LOOP_PREVIEW_EMPHASIS = 3;

/** A loop's frame made `LOOP_PREVIEW_EMPHASIS` times stronger: its distances and angles, and a scale's departure from 1. */
const emphasised = (transform: string): string =>
  transform.replace(/([a-zA-Z]+)\(([-\d.]+)([a-z%]*)\)/g, (_match, fn: string, value: string, unit: string) => {
    const amount = Number(value);
    const strong = fn.startsWith('scale') ? 1 + (amount - 1) * LOOP_PREVIEW_EMPHASIS : amount * LOOP_PREVIEW_EMPHASIS;

    return `${fn}(${String(Number(strong.toFixed(3)))}${unit})`;
  });

/** A loop that keeps turning rather than swinging back: its last frame is a full turn on, which is where it began. */
const isTurn = (loop: MotionLoop): boolean =>
  MOTION_LOOP_FRAMES[loop].frames.some(frame => frame.at === 100 && /360deg/.test(frame.transform));

/** Whether the stage plays this preset stronger than the page does — what its caption owns up to. */
export const isEmphasised = (kind: PresetKind, name: string): boolean => {
  const loop = kind === 'loop' ? MOTION_LOOPS.find(preset => preset === name) : undefined;

  return loop !== undefined && !isTurn(loop);
};

/**
 * A preset played on a tile: the frames the SDK's stylesheet plays (sdk-shared), an arrival at its default duration,
 * a loop at a third of its period — a 6 s float is too slow to read while a pointer rests on it — and, one that swings
 * back, `LOOP_PREVIEW_EMPHASIS` times stronger. A full turn is a turn at any strength.
 */
export const previewOf = (
  kind: PresetKind,
  name: string,
  repeat: boolean
): { keyframes: Keyframe[]; options: KeyframeAnimationOptions } | undefined => {
  const enter = kind === 'enter' ? MOTION_ENTERS.find(preset => preset === name) : undefined;
  if (enter) {
    return {
      keyframes: [
        ...MOTION_ENTER_FRAMES[enter].map(({ at, ...frame }) => ({ ...frame, offset: at / 100 })),
        { opacity: 1, translate: '0 0', scale: '1', rotate: '0deg', offset: 1 }
      ],
      options: {
        duration: MOTION_DEFAULT_DURATION,
        easing: MOTION_ENTER_EASING,
        endDelay: repeat ? PREVIEW_REST_MS : 0,
        iterations: repeat ? Infinity : 1
      }
    };
  }

  const loop = kind === 'loop' ? MOTION_LOOPS.find(preset => preset === name) : undefined;
  if (loop) {
    const { frames, periodMs, easing } = MOTION_LOOP_FRAMES[loop];
    const turn = isTurn(loop);
    const named = frames.map(({ at, transform }) => ({
      transform: turn ? transform : emphasised(transform),
      offset: at / 100
    }));
    // A frame the loop does not name is the element at rest, as the stylesheet leaves it.
    const keyframes = [
      ...(named[0]?.offset === 0 ? [] : [{ transform: 'none', offset: 0 }]),
      ...named,
      ...(named.at(-1)?.offset === 1 ? [] : [{ transform: 'none', offset: 1 }])
    ];

    return { keyframes, options: { duration: periodMs / 3, easing, iterations: repeat ? Infinity : 1 } };
  }

  return undefined;
};
