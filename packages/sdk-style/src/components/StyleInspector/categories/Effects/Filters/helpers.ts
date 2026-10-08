/** One function of a `filter` / `backdrop-filter` list: its name and its argument as written. */
export type FilterValue = { name: string; amount: string };

export type FilterSpec = {
  label: string;
  group: 'General' | 'Color adjustments' | 'Color effects';
  default: string;
  /** Besides none: a proportion is written `0.5` or `50%`, and past 1 the browser clamps it where CSS says to. */
  units: { label: string; value: string }[];
  step: number;
};

const PROPORTION = [{ label: '%', value: '%' }];

/** The functions the editor has a control for: how the picker names them, where a new one starts, what it takes. */
export const FILTER_SPECS: Record<string, FilterSpec> = {
  blur: { label: 'Blur', group: 'General', default: '5px', units: [{ label: 'PX', value: 'px' }], step: 1 },
  opacity: { label: 'Opacity', group: 'General', default: '0.5', units: PROPORTION, step: 0.1 },
  brightness: { label: 'Brightness', group: 'Color adjustments', default: '1', units: PROPORTION, step: 0.1 },
  contrast: { label: 'Contrast', group: 'Color adjustments', default: '1', units: PROPORTION, step: 0.1 },
  'hue-rotate': {
    label: 'Hue rotate',
    group: 'Color adjustments',
    default: '0deg',
    units: [{ label: 'DEG', value: 'deg' }],
    step: 1
  },
  saturate: { label: 'Saturation', group: 'Color adjustments', default: '1', units: PROPORTION, step: 0.1 },
  grayscale: { label: 'Grayscale', group: 'Color effects', default: '0.5', units: PROPORTION, step: 0.1 },
  invert: { label: 'Invert', group: 'Color effects', default: '0.5', units: PROPORTION, step: 0.1 },
  sepia: { label: 'Sepia', group: 'Color effects', default: '0.5', units: PROPORTION, step: 0.1 }
};

export const FILTER_GROUPS = ['General', 'Color adjustments', 'Color effects'] as const;

const FUNCTION = /^([a-z-]+)\((.*)\)$/i;

/**
 * A filter function the editor has a control for. Any other — `drop-shadow(…)`, `url(#svg-filter)`, a token — answers
 * `undefined` and is kept as text.
 */
export const parseFilter = (value: string): FilterValue | undefined => {
  const match = FUNCTION.exec(value.trim());
  if (!match || !(match[1].toLowerCase() in FILTER_SPECS)) {
    return undefined;
  }

  return { name: match[1].toLowerCase(), amount: match[2].trim() };
};

export const serializeFilter = ({ name, amount }: FilterValue): string => `${name}(${amount})`;
