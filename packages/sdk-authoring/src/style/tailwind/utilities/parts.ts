import { BLURS, FONT_FAMILIES, FONT_WEIGHTS } from '../scales';
import {
  NoEquivalent,
  SPACING_SIDES,
  color,
  custom,
  fraction,
  integer,
  looksLikeColor,
  lookup,
  negate,
  one,
  sides,
  size,
  spacing
} from './values';

import type { Declarations, Resolved, TailwindColors } from './values';

export type Family = (rest: string, negative: boolean, colors: TailwindColors) => Resolved;

export const spacingSides =
  (property: 'padding' | 'margin' | 'scroll-margin' | 'scroll-padding', side: string): Family =>
  (rest, negative) => {
    if (negative && property === 'padding') {
      return undefined;
    }

    const value = property === 'margin' && rest === 'auto' ? 'auto' : spacing(rest);
    if (value === undefined) {
      return undefined;
    }

    const longhands = SPACING_SIDES[side].map(edge => `${property}-${edge}`);
    if (property.startsWith('scroll-') && longhands.some(longhand => !longhand.endsWith('-top'))) {
      return new NoEquivalent(
        `Plitzi holds the top one alone: \`${property}-top\` (\`${property === 'scroll-margin' ? 'scroll-mt' : 'scroll-pt'}-…\`).`
      );
    }

    return sides(longhands, negate(value, negative));
  };

export const sized =
  (
    properties: readonly string[],
    axis: 'x' | 'y',
    containers: boolean,
    extra: Readonly<Record<string, string>> = {}
  ): Family =>
  rest =>
    sides(properties, lookup(extra, rest) ?? size(rest, axis, containers));

export const inset =
  (properties: readonly string[]): Family =>
  (rest, negative) => {
    const value = rest === 'auto' ? 'auto' : rest === 'full' ? '100%' : (fraction(rest) ?? spacing(rest));

    return value === undefined ? undefined : sides(properties, negate(value, negative));
  };

const borderWidth = (rest: string): string | undefined =>
  rest === '' ? '1px' : /^\d+$/.test(rest) ? `${rest}px` : custom(rest);

export const borders =
  (edges: readonly string[]): Family =>
  (rest, _negative, colors) => {
    const width = borderWidth(rest);
    if (width !== undefined && !looksLikeColor(custom(rest) ?? '')) {
      return Object.fromEntries(
        edges.flatMap(edge => [
          [`border-${edge}-width`, width],
          [`border-${edge}-style`, 'solid']
        ])
      );
    }

    return sides(
      edges.map(edge => `border-${edge}-color`),
      color(rest, colors)
    );
  };

export const transformPart =
  (parts: readonly string[], unit: (value: string) => string | undefined): Family =>
  (rest, negative) => {
    const value = unit(rest);

    return value === undefined ? undefined : sides(parts, negate(value, negative));
  };

export const spanOf = (value: string): string | undefined => {
  const count = integer(value);

  return count === undefined ? undefined : `span ${count}`;
};

export const lineClamp = (value: string): Declarations | undefined => {
  if (value === 'none') {
    return { 'overflow-x': 'visible', 'overflow-y': 'visible', display: 'block', '-webkit-line-clamp': 'unset' };
  }

  const lines = integer(value);

  return lines === undefined
    ? undefined
    : {
        'overflow-x': 'hidden',
        'overflow-y': 'hidden',
        display: '-webkit-box',
        '-webkit-box-orient': 'vertical',
        '-webkit-line-clamp': lines
      };
};

export const wrapped = (fn: string, value: string | undefined): string | undefined =>
  value === undefined ? undefined : `${fn}(${value})`;

/** A family by name (`font-mono`), a weight (`font-bold`), or either written out — a number is a weight. */
export const font = (value: string): Declarations | undefined => {
  if (Object.hasOwn(FONT_FAMILIES, value)) {
    return { 'font-family': FONT_FAMILIES[value] };
  }

  if (Object.hasOwn(FONT_WEIGHTS, value)) {
    return { 'font-weight': FONT_WEIGHTS[value] };
  }

  const own = custom(value);
  if (own === undefined) {
    return undefined;
  }

  return /^\d+$/.test(own) ? { 'font-weight': own } : { 'font-family': own };
};

export const percent = (value: string): string | undefined => (/^\d+$/.test(value) ? `${value}%` : custom(value));

export const degrees = (value: string): string | undefined => (/^\d+$/.test(value) ? `${value}deg` : custom(value));

export const translation = (value: string): string | undefined =>
  value === 'full' ? '100%' : (fraction(value) ?? spacing(value));

export const filterPart =
  (target: 'filter' | 'backdrop', name: string, unit: (value: string) => string | undefined): Family =>
  rest => {
    const value = unit(rest);

    return value === undefined ? undefined : { [`@${target}.${name}`]: `${name}(${value})` };
  };

export const blur =
  (target: 'filter' | 'backdrop'): Family =>
  rest => {
    const value = lookup(BLURS, rest) ?? custom(rest);

    return value === undefined ? undefined : { [`@${target}.blur`]: `blur(${value})` };
  };

export const gradientStop =
  (stop: 'from' | 'via' | 'to'): Family =>
  (rest, _negative, colors) => {
    if (/^\d+%$/.test(rest)) {
      return { [`@gradient.${stop}-position`]: rest };
    }

    return one(`@gradient.${stop}`, color(rest, colors));
  };
