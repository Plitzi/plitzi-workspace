import { splitBySpaceOutsideParens } from '../../../cssValues';

/** One transition of a `transition` list, its parts named. */
export type TransitionValue = {
  property: string;
  duration: string;
  easing: string;
  delay: string;
};

export const DEFAULT_TRANSITION: TransitionValue = {
  property: 'opacity',
  duration: '200ms',
  easing: 'ease',
  delay: '0ms'
};

const TIME = /^[-+]?(\d|\.\d)[\d.]*m?s$/i;

const EASING_KEYWORDS = new Set(['ease', 'ease-in', 'ease-out', 'ease-in-out', 'linear', 'step-start', 'step-end']);

const EASING_FUNCTION = /^(cubic-bezier|steps|linear)\(/i;

/**
 * A transition as CSS allows it to be written: the parts in any order, any of them left out — the first time is the
 * duration and the second the delay, an easing keyword or function is the easing, and what is left is the property.
 * Anything else (a token for the whole transition) answers `undefined` and is kept as text.
 */
export const parseTransition = (value: string): TransitionValue | undefined => {
  const times: string[] = [];
  let easing: string | undefined;
  let property: string | undefined;

  for (const token of splitBySpaceOutsideParens(value.trim())) {
    if (TIME.test(token)) {
      times.push(token);
    } else if (EASING_KEYWORDS.has(token.toLowerCase()) || EASING_FUNCTION.test(token)) {
      easing = token;
    } else if (property === undefined && /^[a-z-]+$/i.test(token)) {
      property = token;
    } else {
      return undefined;
    }
  }

  if (times.length > 2 || (!property && times.length === 0)) {
    return undefined;
  }

  return {
    property: property ?? 'all',
    duration: times[0] ?? '0s',
    easing: easing ?? 'ease',
    delay: times[1] ?? '0s'
  };
};

/** How a row names a transition: what it animates and for how long, and its delay when it has one. */
export const transitionSummary = ({ property, duration, delay }: TransitionValue): string =>
  /^[-+]?0*\.?0*m?s$/i.test(delay) ? `${property} ${duration}` : `${property} ${duration} after ${delay}`;

export const serializeTransition = ({ property, duration, easing, delay }: TransitionValue): string =>
  `${property} ${duration} ${easing} ${delay}`;

type Bezier = [number, number, number, number];

/** The easings CSS names itself; any other preset is written as the curve it stands for. */
const CSS_EASINGS = new Set(['ease', 'linear', 'ease-in', 'ease-out', 'ease-in-out']);

const presetLabel = (name: string): string =>
  CSS_EASINGS.has(name)
    ? name.charAt(0).toUpperCase() + name.slice(1)
    : name.replace(/([A-Z])/g, ' $1').replace(/^./, first => first.toUpperCase());

export const bezierCss = ([x1, y1, x2, y2]: Bezier): string => `cubic-bezier(${x1}, ${y1}, ${x2}, ${y2})`;

/**
 * An easing preset as CSS can read it. The presets' own names (`easeInQuad`) are not CSS — written as they were, they
 * made the browser drop the whole `transition` — so only CSS's five keywords stay as words.
 */
export const easingCss = (name: string, presets: Record<string, Bezier>): string => {
  const curve = presets[name] as Bezier | undefined;
  if (CSS_EASINGS.has(name) || !curve) {
    return name;
  }

  return bezierCss(curve);
};

export type EasingOption = { label: string; value: string };

/** Every preset as the easing picker offers it: its name for a person, its value for the stylesheet. */
export const easingOptions = (presets: Record<string, Bezier>): EasingOption[] =>
  Object.keys(presets).map(name => ({ label: presetLabel(name), value: easingCss(name, presets) }));

const BEZIER = /^cubic-bezier\(\s*([-\d.]+)\s*,\s*([-\d.]+)\s*,\s*([-\d.]+)\s*,\s*([-\d.]+)\s*\)$/i;

/** The curve an easing draws, for the editor — `undefined` for one that is not a curve (`steps(4)`). */
export const easingCurve = (easing: string, presets: Record<string, Bezier>): Bezier | undefined => {
  const match = BEZIER.exec(easing.trim());
  if (match) {
    return [Number(match[1]), Number(match[2]), Number(match[3]), Number(match[4])];
  }

  return presets[easing.trim()];
};

/** The properties the picker offers, grouped. One a transition names that is not here is offered on its own. */
export const TRANSITION_PROPERTY_GROUPS: { label: string; options: EasingOption[] }[] = [
  {
    label: 'Common',
    options: [
      { label: 'All Properties', value: 'all' },
      { label: 'Opacity', value: 'opacity' },
      { label: 'Transform', value: 'transform' },
      { label: 'Filter', value: 'filter' },
      { label: 'Margin', value: 'margin' },
      { label: 'Padding', value: 'padding' },
      { label: 'Border', value: 'border' },
      { label: 'Flex', value: 'flex' }
    ]
  },
  {
    label: 'Color & background',
    options: [
      { label: 'Color', value: 'color' },
      { label: 'Background Color', value: 'background-color' },
      { label: 'Background Position', value: 'background-position' },
      { label: 'Box Shadow', value: 'box-shadow' },
      { label: 'Text Shadow', value: 'text-shadow' }
    ]
  },
  {
    label: 'Size',
    options: [
      { label: 'Width', value: 'width' },
      { label: 'Height', value: 'height' },
      { label: 'Max Width', value: 'max-width' },
      { label: 'Max Height', value: 'max-height' },
      { label: 'Min Width', value: 'min-width' },
      { label: 'Min Height', value: 'min-height' }
    ]
  },
  {
    label: 'Borders',
    options: [
      { label: 'Border Radius', value: 'border-radius' },
      { label: 'Border Color', value: 'border-color' },
      { label: 'Border Width', value: 'border-width' }
    ]
  },
  {
    label: 'Typography',
    options: [
      { label: 'Font Size', value: 'font-size' },
      { label: 'Line Height', value: 'line-height' },
      { label: 'Letter Spacing', value: 'letter-spacing' },
      { label: 'Text Indent', value: 'text-indent' },
      { label: 'Word Spacing', value: 'word-spacing' }
    ]
  },
  {
    label: 'Position',
    options: [
      { label: 'Top', value: 'top' },
      { label: 'Left', value: 'left' },
      { label: 'Bottom', value: 'bottom' },
      { label: 'Right', value: 'right' },
      { label: 'Z Index', value: 'z-index' }
    ]
  },
  {
    label: 'Margin',
    options: [
      { label: 'Margin Top', value: 'margin-top' },
      { label: 'Margin Right', value: 'margin-right' },
      { label: 'Margin Bottom', value: 'margin-bottom' },
      { label: 'Margin Left', value: 'margin-left' }
    ]
  },
  {
    label: 'Padding',
    options: [
      { label: 'Padding Top', value: 'padding-top' },
      { label: 'Padding Right', value: 'padding-right' },
      { label: 'Padding Bottom', value: 'padding-bottom' },
      { label: 'Padding Left', value: 'padding-left' }
    ]
  },
  {
    label: 'Flex',
    options: [
      { label: 'Flex Grow', value: 'flex-grow' },
      { label: 'Flex Shrink', value: 'flex-shrink' },
      { label: 'Flex Basis', value: 'flex-basis' }
    ]
  }
];

export const isListedProperty = (property: string): boolean =>
  TRANSITION_PROPERTY_GROUPS.some(group => group.options.some(option => option.value === property));
