import { isRecord } from '../helpers/isRecord';

/**
 * An element's declared motion — how it arrives, when, and whether it keeps moving — which the SDK's own stylesheet
 * plays (`_motion.scss`). Every preset moves only `opacity` and `transform`, which the compositor animates without
 * laying the page out again, and every one is stilled for a visitor who asked for less motion: the motion good
 * practices, kept by construction rather than by the author.
 *
 * The one description the authoring package, the builder's Motion tab, the MCP and the validator all read; the
 * stylesheet mirrors its presets and frames, and a test in `apps/sdk` holds the two together.
 */
export const MOTION_ENTERS = ['fade', 'fade-up', 'fade-down', 'slide-left', 'slide-right', 'scale'] as const;

export type MotionEnter = (typeof MOTION_ENTERS)[number];

/** As the page loads, or as the element scrolls into view — tied to the scroll, so it plays at the reader's pace. */
export const MOTION_TRIGGERS = ['load', 'view'] as const;

export type MotionTrigger = (typeof MOTION_TRIGGERS)[number];

/** A motion that repeats: a gentle rise and fall, a breath, a turn, a sway. Held until the page is live. */
export const MOTION_LOOPS = ['float', 'pulse', 'spin', 'sway'] as const;

export type MotionLoop = (typeof MOTION_LOOPS)[number];

export interface ElementMotion {
  /** How it arrives. */
  enter?: MotionEnter;
  /** When it arrives: `load` (the default) or `view`. */
  on?: MotionTrigger;
  /** How long it takes to arrive, in ms (600 by default). Ignored under `view`, which follows the scroll. */
  duration?: number;
  /** How long it waits before it does, in ms. */
  delay?: number;
  /**
   * Its CHILDREN arrive one after another, this many ms apart — a grid of cards, a list's rows — rather than the
   * element itself. Up to the first 24; the rest arrive with the 24th.
   */
  stagger?: number;
  /** Keeps moving after it arrived. */
  loop?: MotionLoop;
}

/** How long an arrival takes when it does not say, and the curve every arrival follows: quick out, gentle in. */
export const MOTION_DEFAULT_DURATION = 600;

export const MOTION_ENTER_EASING = 'cubic-bezier(0.2, 0.7, 0.2, 1)';

/** Where each arrival starts from; it ends where the element is. */
export const MOTION_ENTER_FROM: Record<MotionEnter, { opacity: number; translate?: string; scale?: string }> = {
  fade: { opacity: 0 },
  'fade-up': { opacity: 0, translate: '0 24px' },
  'fade-down': { opacity: 0, translate: '0 -24px' },
  'slide-left': { opacity: 0, translate: '32px 0' },
  'slide-right': { opacity: 0, translate: '-32px 0' },
  scale: { opacity: 0, scale: '0.94' }
};

/**
 * Each loop's one moving frame — its `transform` halfway through the period and back (`middle`), or at the end of
 * one that keeps turning (`end`) — and its period and curve.
 */
export const MOTION_LOOP_FRAMES: Record<
  MotionLoop,
  { transform: string; at: 'middle' | 'end'; periodMs: number; easing: string }
> = {
  float: { transform: 'translateY(-8px)', at: 'middle', periodMs: 6000, easing: 'ease-in-out' },
  pulse: { transform: 'scale(1.04)', at: 'middle', periodMs: 3000, easing: 'ease-in-out' },
  spin: { transform: 'rotate(360deg)', at: 'end', periodMs: 12_000, easing: 'linear' },
  sway: { transform: 'rotate(2deg)', at: 'middle', periodMs: 5000, easing: 'ease-in-out' }
};

/** The longest a duration, a delay or a stagger may be: past it, a page is waiting on its decoration. */
export const MOTION_MAX_MS = 10_000;

const isOneOf = <T extends string>(list: readonly T[], value: unknown): value is T =>
  typeof value === 'string' && (list as readonly string[]).includes(value);

const KEYS = new Set(['enter', 'on', 'duration', 'delay', 'stagger', 'loop']);

/** What is wrong with a value given as an element's `motion`, one sentence each — empty when it is one. */
export const motionProblems = (value: unknown): string[] => {
  if (!isRecord(value)) {
    return ['motion is an object: `{ enter: \'fade-up\', on: \'view\' }`'];
  }

  const problems: string[] = [];
  for (const key of Object.keys(value)) {
    if (!KEYS.has(key)) {
      problems.push(`motion has no "${key}" — it takes enter, on, duration, delay, stagger and loop`);
    }
  }

  if (value.enter !== undefined && !isOneOf(MOTION_ENTERS, value.enter)) {
    problems.push(`motion.enter is one of ${MOTION_ENTERS.join(', ')}`);
  }

  if (value.on !== undefined && !isOneOf(MOTION_TRIGGERS, value.on)) {
    problems.push(`motion.on is ${MOTION_TRIGGERS.join(' or ')}`);
  }

  if (value.loop !== undefined && !isOneOf(MOTION_LOOPS, value.loop)) {
    problems.push(`motion.loop is one of ${MOTION_LOOPS.join(', ')}`);
  }

  for (const key of ['duration', 'delay', 'stagger'] as const) {
    const ms = value[key];
    if (ms !== undefined && (typeof ms !== 'number' || !Number.isFinite(ms) || ms < 0 || ms > MOTION_MAX_MS)) {
      problems.push(`motion.${key} is a number of ms from 0 to ${String(MOTION_MAX_MS)}`);
    }
  }

  if (value.enter === undefined && value.loop === undefined) {
    problems.push('motion says nothing to play: give it an `enter`, a `loop`, or both');
  }

  if (value.stagger !== undefined && value.enter === undefined) {
    problems.push('motion.stagger staggers the children’s `enter`: give it one');
  }

  return problems;
};

export const isMotion = (value: unknown): value is ElementMotion => motionProblems(value).length === 0;

/**
 * What an element with `motion` carries in the DOM: the presets as `data-motion-*` — what the stylesheet animates by —
 * and its timings as custom properties. Nothing at all for an element with none, so its markup stays as it was.
 */
export const motionAttributes = (
  motion: ElementMotion | undefined
): { attributes: Record<string, string>; style: Record<string, string> } => {
  if (!motion) {
    return { attributes: {}, style: {} };
  }

  const attributes: Record<string, string> = {};
  const style: Record<string, string> = {};
  if (motion.enter) {
    attributes[motion.stagger === undefined ? 'data-motion-enter' : 'data-motion-stagger'] = motion.enter;
    attributes['data-motion-on'] = motion.on ?? 'load';
  }

  if (motion.loop) {
    attributes['data-motion-loop'] = motion.loop;
  }

  if (motion.duration !== undefined) {
    style['--plitzi-motion-duration'] = `${String(motion.duration)}ms`;
  }

  if (motion.delay !== undefined) {
    style['--plitzi-motion-delay'] = `${String(motion.delay)}ms`;
  }

  if (motion.stagger !== undefined) {
    style['--plitzi-motion-stagger'] = `${String(motion.stagger)}ms`;
  }

  return { attributes, style };
};

/** Every element the SDK's stylesheet moves: an arrival, a staggered child, a loop. */
export const MOVING_SELECTOR = '[data-motion-enter], [data-motion-stagger] > *, [data-motion-loop]';

/**
 * The builder's canvas, held still: what is being edited is shown as it ends up, rather than arriving again on every
 * change. `MOTION_PLAY_CSS` is the canvas playing — loops included, which a page holds until it is live and an editor
 * never is.
 */
export const MOTION_STILL_CSS = `${MOVING_SELECTOR} { animation: none !important; }`;

export const MOTION_PLAY_CSS = [
  '[data-motion-loop] { animation-play-state: running, running !important; }',
  // An arrival tied to the scroll is played by the clock here: on a canvas being edited the element is usually in view
  // already, where a scroll-driven arrival sits finished and Play would show nothing.
  '[data-motion-on="view"][data-motion-enter], [data-motion-on="view"][data-motion-stagger] > * { animation-timeline: auto, auto !important; }'
].join('\n');

/** Whether an animation is one of the declared motion's — what replaying the canvas restarts, and nothing else. */
export const isMotionAnimation = (animation: object): boolean =>
  'animationName' in animation &&
  typeof animation.animationName === 'string' &&
  animation.animationName.startsWith('plitzi-motion-');
