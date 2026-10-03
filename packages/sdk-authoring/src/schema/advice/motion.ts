/* eslint-disable quotes -- the messages quote code, which reads best in the other quotes */
import { declarationsIn, stylesheetSegments } from '../../style/stylesheet';

import type { Suggestion } from './types';
import type { StylesheetSegment } from '../../style/stylesheet';
import type { Schema, Style, StyleAncestors, StyleObject, StyleStates, StyleVariants } from '@plitzi/sdk-shared';

/**
 * The animations of a space that the browser cannot run on its own.
 *
 * Only `opacity` and `transform` are animated by the compositor, apart from the page's scripts; anything else in a
 * keyframe is repainted, or laid out again, on the main thread on every frame — and freezes while that thread is busy,
 * which it is most while the page hydrates. Three costs, each with its own way out:
 *
 * - a size or a position (`layout`) — the same move as a `transform`;
 * - a blur or a shadow (`blur`) — drawn once, on a layer whose `opacity` changes;
 * - anything else (`paint`: a colour, a gradient, a custom property) — cheap once, so only a loop counts, and a loop is
 *   fine as decoration that starts `paused` and runs under `[data-hydrated]`, the mark the SDK's root carries once the
 *   page is hydrated. A layout or a blur is heavy every time, after hydration too.
 *
 * A property that only switches (`visibility`) is not repainted per frame. Keyframes nothing runs cost nothing and are
 * not mentioned.
 */

type Cost = 'layout' | 'blur' | 'paint';

/** What the compositor animates alone — and the two a keyframe may say about its own timing. */
const COMPOSITED = new Set([
  'opacity',
  'transform',
  'translate',
  'scale',
  'rotate',
  'animation-timing-function',
  'animation-composition'
]);

const LAYOUT =
  /^(?:(?:min-|max-)?(?:width|height)|top|right|bottom|left|inset(?:-[a-z-]+)?|margin(?:-[a-z-]+)?|padding(?:-[a-z-]+)?|font-size|line-height|letter-spacing|word-spacing|gap|row-gap|column-gap|flex-basis|border(?:-(?:top|right|bottom|left))?-width|grid-template-[a-z-]+)$/;

/** Properties that switch between their values instead of passing through the ones between: no frame to repaint. */
const DISCRETE = new Set(['visibility', 'display', 'pointer-events', 'z-index', 'content-visibility']);

const BLUR = new Set(['filter', 'backdrop-filter', '-webkit-backdrop-filter', 'box-shadow', 'text-shadow']);

const KEYFRAMES = /@(?:-webkit-)?keyframes\s+([\w-]+)$/;

const ANIMATION_NAMES = new Set(['animation', 'animation-name', '-webkit-animation', '-webkit-animation-name']);

const PAUSED = /\bpaused\b/;

const RUNNING = /\brunning\b/;

const INFINITE = /\binfinite\b/;

const costOf = (property: string): Cost | undefined => {
  if (COMPOSITED.has(property) || DISCRETE.has(property)) {
    return undefined;
  }

  if (LAYOUT.test(property)) {
    return 'layout';
  }

  return BLUR.has(property) ? 'blur' : 'paint';
};

/** Keyframes by name, with what each animates off the compositor. */
const keyframesIn = (segments: StylesheetSegment[], found: Map<string, Map<string, Cost>>) => {
  for (const segment of segments) {
    if (segment.kind !== 'atRule') {
      continue;
    }

    const name = KEYFRAMES.exec(segment.prelude)?.[1];
    if (!name) {
      keyframesIn(stylesheetSegments(segment.body), found);
      continue;
    }

    const costs = new Map<string, Cost>();
    for (const frame of stylesheetSegments(segment.body)) {
      if (frame.kind !== 'rule') {
        continue;
      }

      for (const [property] of declarationsIn(frame.body)) {
        const cost = costOf(property);
        if (cost) {
          costs.set(property, cost);
        }
      }
    }

    if (costs.size > 0) {
      found.set(name, costs);
    }
  }

  return found;
};

/** One place an animation is named: the keyframes it names, whether it loops, and whether it starts paused there. */
interface AnimationUse {
  names: string[];
  infinite: boolean;
  paused: boolean;
}

const animationUseOf = (
  declarations: [string, string][],
  keyframes: Map<string, unknown>
): AnimationUse | undefined => {
  const names = declarations
    .filter(([property]) => ANIMATION_NAMES.has(property))
    .flatMap(([, value]) => value.split(/[\s,]+/).filter(word => keyframes.has(word)));
  if (names.length === 0) {
    return undefined;
  }

  const says = (longhand: string, word: RegExp) =>
    declarations.some(([property, value]) => (property === longhand || property === 'animation') && word.test(value));

  return { names, infinite: says('animation-iteration-count', INFINITE), paused: says('animation-play-state', PAUSED) };
};

interface CssUses {
  uses: AnimationUse[];
  /** A `[data-hydrated]` rule setting `animation-play-state: running` — what lets paused ones run. */
  hydratedGate: boolean;
}

/** The animations `customCss` starts, and whether it lets paused ones run once the page is hydrated. */
const cssUsesIn = (segments: StylesheetSegment[], keyframes: Map<string, unknown>): CssUses => {
  const uses: AnimationUse[] = [];
  let hydratedGate = false;
  for (const segment of segments) {
    if (segment.kind === 'atRule') {
      if (!KEYFRAMES.test(segment.prelude)) {
        const inner = cssUsesIn(stylesheetSegments(segment.body), keyframes);
        uses.push(...inner.uses);
        hydratedGate ||= inner.hydratedGate;
      }

      continue;
    }

    if (segment.kind !== 'rule') {
      continue;
    }

    const declarations = declarationsIn(segment.body);
    const use = animationUseOf(declarations, keyframes);
    if (use) {
      uses.push(use);
    }

    if (
      segment.selector.includes('[data-hydrated]') &&
      declarations.some(([property, value]) => property === 'animation-play-state' && RUNNING.test(value))
    ) {
      hydratedGate = true;
    }
  }

  return { uses, hydratedGate };
};

type StyleLayer = {
  default?: StyleObject;
  states?: StyleStates;
  variants?: StyleVariants;
  ancestors?: StyleAncestors;
};

/** Every rule set of a selector: its own, its states', its variants' and its ancestors'. */
const ruleSetsOf = (layer: StyleLayer): StyleObject[] => [
  ...(layer.default ? [layer.default] : []),
  ...Object.values(layer.states ?? {}),
  ...Object.values(layer.variants ?? {}).flatMap(ruleSetsOf),
  ...Object.values(layer.ancestors ?? {}).flatMap(ruleSetsOf)
];

/** The animations the style schema starts — its classes, ids and element styles, at every breakpoint. */
const styleUsesIn = (style: Style, keyframes: Map<string, unknown>): AnimationUse[] =>
  Object.values(style.platform)
    .flatMap(items => Object.values(items))
    .flatMap(item => Object.values(item.attributes))
    .flatMap(ruleSetsOf)
    .flatMap(rules => {
      const use = animationUseOf(
        Object.entries(rules).map(([property, value]) => [property, String(value)]),
        keyframes
      );

      return use ? [use] : [];
    });

const COST_ORDER: Cost[] = ['layout', 'blur', 'paint'];

/** The way out of each cost, given in `COST_ORDER`. */
const CLAUSES: Record<Cost, string> = {
  layout: 'a size or a position is a `transform` (`translate`, `scale`) of an element already at its full size',
  blur: 'a blur or a shadow is drawn once, on a layer whose `opacity` changes',
  paint:
    'a loop that has to animate anything else is decoration — start it `paused` and run it once the page is ' +
    'hydrated: `[data-hydrated] .glow { animation-play-state: running; }` in `customCss`'
};

export const suggestMotion = (schema: Schema, style: Style): Suggestion[] => {
  const customCss = schema.settings.customCss;
  if (!customCss.trim()) {
    return [];
  }

  const segments = stylesheetSegments(customCss);
  const keyframes = keyframesIn(segments, new Map());
  if (keyframes.size === 0) {
    return [];
  }

  const { uses, hydratedGate } = cssUsesIn(segments, keyframes);
  uses.push(...styleUsesIn(style, keyframes));

  const heavy = [...keyframes].flatMap(([name, costs]) => {
    const named = uses.filter(use => use.names.includes(name));
    if (named.length === 0) {
      return [];
    }

    const looping = named.some(use => use.infinite && !(hydratedGate && use.paused));
    const properties = [...costs].filter(([, cost]) => cost !== 'paint' || looping);

    return properties.length > 0 ? [{ name, properties }] : [];
  });
  if (heavy.length === 0) {
    return [];
  }

  const costs = new Set(heavy.flatMap(({ properties }) => properties.map(([, cost]) => cost)));
  const listed = heavy.map(
    ({ name, properties }) => `\`${name}\` (${properties.map(([property]) => `\`${property}\``).join(', ')})`
  );
  const one = heavy.length === 1;

  return [
    {
      code: 'heavy-animation',
      elementIds: [],
      saves: 0,
      message:
        `${String(heavy.length)} animation${one ? '' : 's'} in \`customCss\` ${one ? 'animates' : 'animate'} what the ` +
        `browser repaints or lays out again on every frame — ${listed.slice(0, 4).join(', ')}` +
        `${listed.length > 4 ? ', …' : ''} — on the main thread, so ${one ? 'it stutters' : 'they stutter'} whenever ` +
        "the page's scripts are busy, most of all while it loads. Animate `opacity` and `transform`: " +
        COST_ORDER.filter(cost => costs.has(cost))
          .map(cost => CLAUSES[cost])
          .join('; ') +
        '.'
    }
  ];
};
