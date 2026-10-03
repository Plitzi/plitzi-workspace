import { DEFAULT_TRANSITION } from './scales';
import { KNOWN_NAMES, NoEquivalent, resolveUtility } from './utilities';
import { AuthoringError } from '../../schema/codes';
import { didYouMean } from '../../schema/suggest';

import type { Declarations, TailwindColors } from './utilities';
import type { AncestorSpec, CssProps, ResponsiveCss, RuleSetSpec } from '../types';
import type { StyleState } from '@plitzi/sdk-shared';

/** The three ranges a Plitzi style is written for: below 48rem, 48–64rem, and above. */
type Range = 'mobile' | 'tablet' | 'desktop';

/**
 * Tailwind's breakpoints that fall on Plitzi's: `md` (48rem) is where a tablet starts and `lg` (64rem) where a desktop
 * does, so each one is a set of the three ranges. The order is the one Tailwind's stylesheet gives them, later winning.
 */
const BREAKPOINTS = {
  base: ['mobile', 'tablet', 'desktop'],
  md: ['tablet', 'desktop'],
  lg: ['desktop'],
  'max-lg': ['mobile', 'tablet'],
  'max-md': ['mobile']
} as const satisfies Record<string, readonly Range[]>;

type Breakpoint = keyof typeof BREAKPOINTS;

const isBreakpoint = (name: string): name is Breakpoint => Object.hasOwn(BREAKPOINTS, name);

const BREAKPOINT_ORDER = Object.keys(BREAKPOINTS).filter(isBreakpoint);

const STATES = ['hover', 'focus', 'focus-visible', 'focus-within', 'active', 'disabled', 'checked', 'visited'] as const;

type TwState = (typeof STATES)[number];

const isState = (name: string): name is TwState => STATES.some(state => state === name);

/** Which part of the class a class writes to: its own rules, a state of them, or how it looks inside an ancestor. */
interface Target {
  state?: StyleState;
  ancestor?: { name: string; state?: StyleState };
}

const targetKey = ({ state, ancestor }: Target): string =>
  `${state ?? ''}|${ancestor ? `${ancestor.name}:${ancestor.state ?? ''}` : ''}`;

interface Written {
  value: string;
  /** How many declarations the class that wrote it makes: Tailwind lets the narrower one win (`px-4 pl-2`). */
  weight: number;
  by: string;
}

const refuse = (code: 'tw-unknown-class' | 'tw-no-equivalent' | 'tw-class-conflict', reason: string): never => {
  throw new AuthoringError(code, reason);
};

const BREAKPOINT_HELP =
  'Plitzi has three ranges — mobile below 48rem, tablet 48–64rem, desktop above — so `md:` (tablet and desktop), `lg:` (desktop), `max-md:` (mobile) and `max-lg:` (mobile and tablet) have an equivalent and the others do not.';

/** The variants a class is written under: `md:hover:bg-x` is `md`, `hover`, `bg-x`. Brackets keep their colons. */
const splitVariants = (written: string): string[] => {
  const parts: string[] = [];
  let depth = 0;
  let start = 0;
  for (let index = 0; index < written.length; index += 1) {
    const char = written[index];
    if (char === '[' || char === '(') {
      depth += 1;
    } else if (char === ']' || char === ')') {
      depth -= 1;
    } else if (char === ':' && depth === 0) {
      parts.push(written.slice(start, index));
      start = index + 1;
    }
  }

  parts.push(written.slice(start));

  return parts;
};

interface Parsed {
  breakpoint: Breakpoint;
  target: Target;
  utility: string;
}

const parseClass = (written: string): Parsed => {
  if (written.startsWith('!') || written.endsWith('!')) {
    return refuse(
      'tw-no-equivalent',
      `"${written}": \`!important\` has no place in Plitzi's styles — a rule wins by being the element's own (\`class: [shared, { … }]\`) or a state's.`
    );
  }

  const parts = splitVariants(written);
  const utility = parts.at(-1) ?? '';
  let breakpoint: Breakpoint = 'base';
  const target: Target = {};
  for (const variant of parts.slice(0, -1)) {
    const group = /^group-([a-z-]+)\/([\w-]+)$/.exec(variant);
    const unnamedGroup = /^group-([a-z-]+)$/.exec(variant);
    if (isBreakpoint(variant) && variant !== 'base' && breakpoint === 'base') {
      breakpoint = variant;
    } else if (isState(variant) && target.state === undefined && target.ancestor === undefined) {
      target.state = variant;
    } else if (group && isState(group[1]) && target.ancestor === undefined && target.state === undefined) {
      target.ancestor = { name: group[2], state: group[1] };
    } else if (unnamedGroup && isState(unnamedGroup[1])) {
      return refuse(
        'tw-no-equivalent',
        `"${written}": an ancestor is named by a class it wears — write \`group-${unnamedGroup[1]}/<class>:\`, with the class of the element whose ${unnamedGroup[1]} it is.`
      );
    } else if (/^(sm|xl|2xl|max-sm|max-xl|max-2xl|min-\[.+\]|max-\[.+\])$/.test(variant)) {
      return refuse(
        'tw-no-equivalent',
        `"${written}": \`${variant}:\` falls inside one of Plitzi's breakpoints. ${BREAKPOINT_HELP}`
      );
    } else if (variant === 'dark') {
      return refuse(
        'tw-no-equivalent',
        `"${written}": a colour for each theme is a token with both values — \`variables.color.ink: { light, dark, default }\` — read with \`var(--ink)\` (give it to tw() through \`createTw({ colors })\`).`
      );
    } else {
      return refuse(
        'tw-no-equivalent',
        `"${written}": \`${variant}:\` is not something a Plitzi style holds. It holds a breakpoint (md, lg, max-md, max-lg), one state (${STATES.join(', ')}) or an ancestor's state (\`group-hover/<class>:\`), once each.`
      );
    }
  }

  return { breakpoint, target, utility };
};

/** The property a part is put together into: `@translate-x` and `@rotate` are both the `transform`. */
const groupOf = (key: string): string => {
  if (/^@(translate|rotate|scale|skew)-?/.test(key)) {
    return 'transform';
  }

  if (/^@(shadow|ring)/.test(key)) {
    return 'box-shadow';
  }

  return /^@([a-z]+)/.exec(key)?.[1] ?? key;
};

/** What a class set, or nothing: the parts are only the ones some class wrote. */
const at = (declarations: Declarations, key: string): string | undefined =>
  Object.hasOwn(declarations, key) ? declarations[key] : undefined;

const transformOf = (parts: Declarations): string | undefined => {
  const pieces = [
    at(parts, '@translate-x') !== undefined || at(parts, '@translate-y') !== undefined
      ? `translate(${at(parts, '@translate-x') ?? '0px'}, ${at(parts, '@translate-y') ?? '0px'})`
      : '',
    at(parts, '@rotate') === undefined ? '' : `rotate(${at(parts, '@rotate')})`,
    at(parts, '@scale-x') !== undefined || at(parts, '@scale-y') !== undefined
      ? `scale(${at(parts, '@scale-x') ?? '100%'}, ${at(parts, '@scale-y') ?? '100%'})`
      : '',
    at(parts, '@skew-x') === undefined ? '' : `skewX(${at(parts, '@skew-x')})`,
    at(parts, '@skew-y') === undefined ? '' : `skewY(${at(parts, '@skew-y')})`
  ].filter(Boolean);

  return pieces.length === 0 ? undefined : pieces.join(' ');
};

const FILTER_ORDER = ['blur', 'brightness', 'contrast', 'grayscale', 'hue-rotate', 'invert', 'saturate', 'sepia'];

const filterOf = (parts: Declarations, prefix: '@filter' | '@backdrop'): string | undefined => {
  const pieces = [...FILTER_ORDER, 'drop-shadow']
    .map(name => at(parts, `${prefix}.${name}`))
    .filter((piece): piece is string => piece !== undefined && piece !== '');

  return pieces.length === 0 ? undefined : pieces.join(' ');
};

const gradientOf = (parts: Declarations): string | undefined => {
  const position = at(parts, '@gradient.position');
  if (position === undefined) {
    return undefined;
  }

  const stop = (name: 'from' | 'via' | 'to', fallback: string): string =>
    [at(parts, `@gradient.${name}`) ?? fallback, at(parts, `@gradient.${name}-position`)].filter(Boolean).join(' ');
  const stops = [
    stop('from', '#0000'),
    ...(at(parts, '@gradient.via') === undefined ? [] : [stop('via', '#0000')]),
    stop('to', '#0000')
  ];

  return position === 'radial'
    ? `radial-gradient(in oklab, ${stops.join(', ')})`
    : `linear-gradient(${position} in oklab, ${stops.join(', ')})`;
};

const boxShadowOf = (parts: Declarations): string | undefined => {
  const ringWidth = at(parts, '@ring-width');
  const ring =
    ringWidth === undefined
      ? undefined
      : `${at(parts, '@ring-inset') ?? ''}0 0 0 ${ringWidth} ${at(parts, '@ring-color') ?? 'currentcolor'}`;
  const tint = at(parts, '@shadow-color');
  const shadow =
    tint === undefined ? at(parts, '@shadow') : at(parts, '@shadow')?.replace(/rgb\(0 0 0 \/ [\d.]+\)/g, tint);
  const layers = [ring, shadow].filter((layer): layer is string => layer !== undefined);

  return layers.length === 0 ? undefined : layers.join(', ');
};

/** The declarations of one range, with every composed property put together and the parts dropped. */
const composed = (declarations: Declarations): CssProps => {
  const css: CssProps = Object.fromEntries(Object.entries(declarations).filter(([key]) => !key.startsWith('@')));
  const whole: Record<string, string | undefined> = {
    transform: transformOf(declarations),
    filter: filterOf(declarations, '@filter'),
    'backdrop-filter': filterOf(declarations, '@backdrop'),
    'background-image': gradientOf(declarations),
    'box-shadow': boxShadowOf(declarations)
  };
  for (const [property, value] of Object.entries(whole)) {
    if (value !== undefined) {
      css[property] = value;
    }
  }

  const transition = at(declarations, '@transition');
  if (transition !== undefined) {
    css['transition-property'] = transition;
    css['transition-duration'] = at(declarations, 'transition-duration') ?? DEFAULT_TRANSITION.duration;
    css['transition-timing-function'] = at(declarations, 'transition-timing-function') ?? DEFAULT_TRANSITION.timing;
  }

  return css;
};

/** One target's declarations, per breakpoint as written, each by the class that wrote it. */
type Bucket = Partial<Record<Breakpoint, Map<string, Written>>>;

/** What a target holds in each range: every breakpoint that reaches the range, later ones over earlier ones. */
const byRange = (bucket: Bucket): Record<Range, Declarations> => {
  const ranges: Record<Range, Declarations> = { mobile: {}, tablet: {}, desktop: {} };
  for (const breakpoint of BREAKPOINT_ORDER) {
    const written = bucket[breakpoint];
    if (written === undefined) {
      continue;
    }

    const reaches: readonly Range[] = BREAKPOINTS[breakpoint];
    for (const range of reaches) {
      for (const [key, { value }] of written) {
        ranges[range][key] = value;
      }
    }
  }

  return ranges;
};

/**
 * A state's or an ancestor's declarations in one range, with the parts of the element's own composed properties it
 * builds on: `translate-x-2 hover:scale-105` is a hover transform that still translates.
 */
const onTopOf = (own: Declarations, layer: Declarations): Declarations => {
  const groups = new Set(
    Object.keys(layer)
      .filter(key => key.startsWith('@'))
      .map(groupOf)
  );
  const inherited = Object.entries(own).filter(([key]) => key.startsWith('@') && groups.has(groupOf(key)));

  return { ...Object.fromEntries(inherited), ...layer };
};

/**
 * Desktop-first, as Plitzi writes it: the desktop rules apply everywhere, and tablet and mobile say only where they
 * differ — a property the desktop sets and a narrower range does not is `revert`, which is what "no rule here" is.
 */
const responsive = (ranges: Record<Range, CssProps>): ResponsiveCss | CssProps => {
  const { desktop } = ranges;
  const differences = (range: CssProps): CssProps => {
    const changed: CssProps = Object.fromEntries(
      Object.entries(range).filter(([property, value]) => desktop[property] !== value)
    );
    for (const property of Object.keys(desktop)) {
      if (!Object.hasOwn(range, property)) {
        changed[property] = 'revert';
      }
    }

    return changed;
  };
  const tablet = differences(ranges.tablet);
  const mobile = differences(ranges.mobile);
  if (Object.keys(tablet).length === 0 && Object.keys(mobile).length === 0) {
    return desktop;
  }

  return {
    ...(Object.keys(desktop).length === 0 ? {} : { desktop }),
    ...(Object.keys(tablet).length === 0 ? {} : { tablet }),
    ...(Object.keys(mobile).length === 0 ? {} : { mobile })
  };
};

const rangesOf = (bucket: Bucket, own?: Record<Range, Declarations>): Record<Range, CssProps> => {
  const layer = byRange(bucket);

  return {
    mobile: composed(own ? onTopOf(own.mobile, layer.mobile) : layer.mobile),
    tablet: composed(own ? onTopOf(own.tablet, layer.tablet) : layer.tablet),
    desktop: composed(own ? onTopOf(own.desktop, layer.desktop) : layer.desktop)
  };
};

export interface TwOptions {
  /**
   * Colour names beside Tailwind's palette, or in place of one of its names: the space's tokens, so `bg-surface` is
   * `var(--surface)` — `createTw({ colors: tokens(variables) })`.
   */
  colors?: TailwindColors;
}

/** Turns Tailwind classes into the rules `styles()` takes. See {@link createTw}. */
export type Tw = (classes: string) => RuleSetSpec;

/**
 * A `tw()` with colours of its own: `createTw({ colors: tokens(variables) })` makes `bg-surface` the space's token.
 *
 * `tw('flex items-center gap-2 px-5 py-2 rounded-full bg-slate-950/90 hover:scale-105 md:text-sm')` is the rules those
 * classes mean, written out when the space is — nothing of Tailwind runs in the page. Tailwind's breakpoints become
 * Plitzi's (`md:` tablet and desktop, `lg:` desktop, `max-md:` mobile, `max-lg:` tablet and mobile), its states the
 * class's states, `group-hover/<class>:` how it looks inside an ancestor wearing that class. A class Tailwind does not
 * have, or one with no exact equivalent here (`sm:`, `dark:`, `space-x-4`), is refused with what to write instead.
 */
export const createTw =
  ({ colors = {} }: TwOptions = {}): Tw =>
  classes => {
    const buckets = new Map<string, { target: Target; bucket: Bucket }>([['|', { target: {}, bucket: {} }]]);
    for (const written of classes.split(/\s+/).filter(Boolean)) {
      const { breakpoint, target, utility } = parseClass(written);
      const resolved = resolveUtility(utility, colors);
      if (resolved === undefined) {
        return refuse(
          'tw-unknown-class',
          `"${written}" is not a Tailwind class tw() knows${didYouMean(utility, KNOWN_NAMES)} A colour of the space is \`createTw({ colors })\`; any CSS at all is \`[property:value]\`.`
        );
      }

      if (resolved instanceof NoEquivalent) {
        return refuse('tw-no-equivalent', `"${written}": ${resolved.reason}`);
      }

      const key = targetKey(target);
      const entry = buckets.get(key) ?? { target, bucket: {} };
      buckets.set(key, entry);
      const declared = entry.bucket[breakpoint] ?? new Map<string, Written>();
      entry.bucket[breakpoint] = declared;
      const weight = Object.keys(resolved).length;
      for (const [property, value] of Object.entries(resolved)) {
        const earlier = declared.get(property);
        if (earlier && earlier.weight === weight && earlier.value !== value) {
          return refuse(
            'tw-class-conflict',
            `"${earlier.by}" and "${written}" both set \`${property}\`, and neither is the narrower one — Tailwind would pick by its own order, not yours. Keep one.`
          );
        }

        if (!earlier || weight <= earlier.weight) {
          declared.set(property, { value, weight, by: written });
        }
      }
    }

    const own = buckets.get('|')?.bucket ?? {};
    const ownRanges = byRange(own);
    const rules: RuleSetSpec = { css: responsive(rangesOf(own)) };
    for (const [key, { target, bucket }] of buckets) {
      if (key === '|') {
        continue;
      }

      const css = responsive(rangesOf(bucket, ownRanges));
      if (target.state) {
        rules.states = { ...rules.states, [target.state]: css };
      } else if (target.ancestor) {
        const ancestors: Record<string, AncestorSpec> = { ...rules.ancestors };
        const { name, state } = target.ancestor;
        const ancestor = ancestors[name] ?? {};
        ancestors[name] = state ? { ...ancestor, states: { ...ancestor.states, [state]: css } } : { ...ancestor, css };
        rules.ancestors = ancestors;
      }
    }

    return rules;
  };

/** {@link createTw} with Tailwind's palette and nothing else. */
export const tw: Tw = createTw();
