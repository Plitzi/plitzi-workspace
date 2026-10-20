import { DROP_SHADOWS, EASINGS, LEADING, RADII, SHADOWS, TEXT_SIZES, TRACKING, TRANSITIONS } from '../scales';
import {
  blur,
  borders,
  degrees,
  filterPart,
  font,
  gradientStop,
  inset,
  lineClamp,
  percent,
  sized,
  spacingSides,
  spanOf,
  transformPart,
  translation,
  wrapped
} from './parts';
import {
  ALIGN,
  RADIUS_CORNERS,
  SPACING_SIDES,
  color,
  custom,
  integer,
  looksLikeColor,
  lookup,
  negate,
  negated,
  one,
  sides,
  size,
  spacing,
  trim
} from './values';

import type { Family } from './parts';

/** Every family, longest prefix first, so `border-t` is read before `border` and `max-w` before nothing. */
const FAMILY_LIST: [string, Family][] = [
  ...Object.keys(SPACING_SIDES).map((side): [string, Family] => [`p${side}`, spacingSides('padding', side)]),
  ...Object.keys(SPACING_SIDES).map((side): [string, Family] => [`m${side}`, spacingSides('margin', side)]),
  ...Object.keys(SPACING_SIDES).map((side): [string, Family] => [
    `scroll-m${side}`,
    spacingSides('scroll-margin', side)
  ]),
  ...Object.keys(SPACING_SIDES).map((side): [string, Family] => [
    `scroll-p${side}`,
    spacingSides('scroll-padding', side)
  ]),
  ['gap', rest => sides(['row-gap', 'column-gap'], spacing(rest))],
  ['gap-x', rest => one('column-gap', spacing(rest))],
  ['gap-y', rest => one('row-gap', spacing(rest))],
  ['w', sized(['width'], 'x', true)],
  ['h', sized(['height'], 'y', false)],
  ['size', sized(['width', 'height'], 'x', false)],
  ['min-w', sized(['min-width'], 'x', true)],
  ['min-h', sized(['min-height'], 'y', false)],
  ['max-w', sized(['max-width'], 'x', true, { none: 'none', prose: '65ch' })],
  ['max-h', sized(['max-height'], 'y', false, { none: 'none' })],
  ['inset', inset(['top', 'right', 'bottom', 'left'])],
  ['inset-x', inset(['left', 'right'])],
  ['inset-y', inset(['top', 'bottom'])],
  ['top', inset(['top'])],
  ['right', inset(['right'])],
  ['bottom', inset(['bottom'])],
  ['left', inset(['left'])],
  ['z', (rest, negative) => one('z-index', rest === 'auto' ? 'auto' : negated(integer(rest), negative))],
  [
    'order',
    (rest, negative) =>
      one('order', lookup({ first: '-9999', last: '9999', none: '0' }, rest) ?? negated(integer(rest), negative))
  ],
  ['basis', rest => one('flex-basis', size(rest, 'x', true))],
  ['grow', rest => one('flex-grow', integer(rest))],
  ['shrink', rest => one('flex-shrink', integer(rest))],
  ['flex', rest => (/^\d+$/.test(rest) ? { 'flex-grow': rest, 'flex-shrink': '1', 'flex-basis': '0%' } : undefined)],
  [
    'grid-cols',
    rest =>
      one(
        'grid-template-columns',
        rest === 'none'
          ? 'none'
          : rest === 'subgrid'
            ? 'subgrid'
            : /^\d+$/.test(rest)
              ? `repeat(${rest}, minmax(0, 1fr))`
              : custom(rest)
      )
  ],
  [
    'grid-rows',
    rest =>
      one(
        'grid-template-rows',
        rest === 'none'
          ? 'none'
          : rest === 'subgrid'
            ? 'subgrid'
            : /^\d+$/.test(rest)
              ? `repeat(${rest}, minmax(0, 1fr))`
              : custom(rest)
      )
  ],
  ['col-span', rest => sides(['grid-column-start', 'grid-column-end'], spanOf(rest))],
  ['row-span', rest => sides(['grid-row-start', 'grid-row-end'], spanOf(rest))],
  ['col-start', rest => one('grid-column-start', rest === 'auto' ? 'auto' : integer(rest))],
  ['col-end', rest => one('grid-column-end', rest === 'auto' ? 'auto' : integer(rest))],
  ['row-start', rest => one('grid-row-start', rest === 'auto' ? 'auto' : integer(rest))],
  ['row-end', rest => one('grid-row-end', rest === 'auto' ? 'auto' : integer(rest))],
  [
    'auto-cols',
    rest =>
      one(
        'grid-auto-columns',
        lookup({ auto: 'auto', min: 'min-content', max: 'max-content', fr: 'minmax(0, 1fr)' }, rest) ?? custom(rest)
      )
  ],
  [
    'auto-rows',
    rest =>
      one(
        'grid-auto-rows',
        lookup({ auto: 'auto', min: 'min-content', max: 'max-content', fr: 'minmax(0, 1fr)' }, rest) ?? custom(rest)
      )
  ],
  ['justify', rest => one('justify-content', lookup(ALIGN, rest))],
  ['content', rest => one('align-content', lookup(ALIGN, rest))],
  ['place-content', rest => sides(['align-content', 'justify-content'], lookup(ALIGN, rest))],
  [
    'place-items',
    rest =>
      sides(
        ['align-items', 'justify-items'],
        lookup({ start: 'start', end: 'end', center: 'center', stretch: 'stretch', baseline: 'baseline' }, rest)
      )
  ],
  ['aspect', rest => one('aspect-ratio', /^\d+\/\d+$/.test(rest) ? rest.replace('/', ' / ') : custom(rest))],
  ['columns', rest => one('column-count', integer(rest))],
  ['opacity', rest => one('opacity', /^\d+$/.test(rest) ? trim(Number(rest) / 100) : custom(rest))],
  [
    'text',
    (rest, _negative, colors) => {
      const slash = rest.indexOf('/');
      const name = slash === -1 ? rest : rest.slice(0, slash);
      const leading = slash === -1 ? undefined : rest.slice(slash + 1);
      if (Object.hasOwn(TEXT_SIZES, name)) {
        const [fontSize, lineHeight] = TEXT_SIZES[name];
        const height = leading === undefined ? lineHeight : (lookup(LEADING, leading) ?? spacing(leading));

        return height === undefined ? undefined : { 'font-size': fontSize, 'line-height': height };
      }

      const own = custom(rest);
      if (own !== undefined && !rest.startsWith('(') && !looksLikeColor(own)) {
        return { 'font-size': own };
      }

      return one('color', color(rest, colors));
    }
  ],
  ['font', rest => font(rest)],
  ['tracking', (rest, negative) => one('letter-spacing', negated(lookup(TRACKING, rest) ?? custom(rest), negative))],
  ['leading', rest => one('line-height', lookup(LEADING, rest) ?? spacing(rest))],
  ['indent', (rest, negative) => one('text-indent', negated(spacing(rest), negative))],
  ['line-clamp', rest => lineClamp(rest)],
  [
    'decoration',
    (rest, _negative, colors) =>
      /^\d+$/.test(rest)
        ? { 'text-decoration-thickness': `${rest}px` }
        : rest === 'auto' || rest === 'from-font'
          ? { 'text-decoration-thickness': rest }
          : one('text-decoration-color', color(rest, colors))
  ],
  [
    'underline-offset',
    rest => one('text-underline-offset', /^\d+$/.test(rest) ? `${rest}px` : rest === 'auto' ? 'auto' : custom(rest))
  ],
  [
    'bg',
    (rest, _negative, colors) => {
      const own = custom(rest);
      if (own !== undefined && /^(url\(|linear-gradient|radial-gradient|conic-gradient|image\()/.test(own)) {
        return { 'background-image': own };
      }

      const angle = /^linear-(\d+)$/.exec(rest);
      if (angle) {
        return { '@gradient.position': `${angle[1]}deg` };
      }

      return one('background-color', color(rest, colors));
    }
  ],
  ['from', gradientStop('from')],
  ['via', gradientStop('via')],
  ['to', gradientStop('to')],
  ['border', borders(['top', 'right', 'bottom', 'left'])],
  ['border-x', borders(['left', 'right'])],
  ['border-y', borders(['top', 'bottom'])],
  ['border-t', borders(['top'])],
  ['border-r', borders(['right'])],
  ['border-b', borders(['bottom'])],
  ['border-l', borders(['left'])],
  ['border-spacing', rest => one('border-spacing', spacing(rest))],
  ...Object.entries(RADIUS_CORNERS).map(([corner, corners]): [string, Family] => [
    corner === '' ? 'rounded' : `rounded-${corner}`,
    rest =>
      sides(
        corners.map(name => `border-${name}-radius`),
        lookup(RADII, rest) ?? custom(rest)
      )
  ]),
  [
    'outline',
    (rest, _negative, colors) =>
      rest === ''
        ? { 'outline-width': '1px', 'outline-style': 'solid' }
        : /^\d+$/.test(rest)
          ? { 'outline-width': `${rest}px`, 'outline-style': 'solid' }
          : one('outline-color', color(rest, colors))
  ],
  [
    'outline-offset',
    (rest, negative) => one('outline-offset', /^\d+$/.test(rest) ? negate(`${rest}px`, negative) : custom(rest))
  ],
  [
    'ring',
    (rest, _negative, colors) =>
      rest === ''
        ? { '@ring-width': '1px' }
        : /^\d+$/.test(rest)
          ? { '@ring-width': `${rest}px` }
          : one('@ring-color', color(rest, colors))
  ],
  [
    'shadow',
    (rest, _negative, colors) =>
      one('@shadow', lookup(SHADOWS, rest) ?? custom(rest)) ?? one('@shadow-color', color(rest, colors))
  ],
  [
    'drop-shadow',
    rest => one('@filter.drop-shadow', lookup(DROP_SHADOWS, rest) ?? wrapped('drop-shadow', custom(rest)))
  ],
  ['blur', blur('filter')],
  ['brightness', filterPart('filter', 'brightness', percent)],
  ['contrast', filterPart('filter', 'contrast', percent)],
  ['saturate', filterPart('filter', 'saturate', percent)],
  ['grayscale', filterPart('filter', 'grayscale', percent)],
  ['invert', filterPart('filter', 'invert', percent)],
  ['sepia', filterPart('filter', 'sepia', percent)],
  ['hue-rotate', filterPart('filter', 'hue-rotate', degrees)],
  ['backdrop-blur', blur('backdrop')],
  ['backdrop-brightness', filterPart('backdrop', 'brightness', percent)],
  ['backdrop-contrast', filterPart('backdrop', 'contrast', percent)],
  ['backdrop-saturate', filterPart('backdrop', 'saturate', percent)],
  ['backdrop-grayscale', filterPart('backdrop', 'grayscale', percent)],
  ['mix-blend', rest => one('mix-blend-mode', /^[a-z-]+$/.test(rest) ? rest : undefined)],
  ['transition', rest => one('@transition', lookup(TRANSITIONS, rest) ?? custom(rest))],
  ['duration', rest => one('transition-duration', /^\d+$/.test(rest) ? `${rest}ms` : custom(rest))],
  ['delay', rest => one('transition-delay', /^\d+$/.test(rest) ? `${rest}ms` : custom(rest))],
  ['ease', rest => one('transition-timing-function', lookup(EASINGS, rest) ?? custom(rest))],
  ['scale', transformPart(['@scale-x', '@scale-y'], percent)],
  ['scale-x', transformPart(['@scale-x'], percent)],
  ['scale-y', transformPart(['@scale-y'], percent)],
  ['rotate', transformPart(['@rotate'], degrees)],
  ['skew-x', transformPart(['@skew-x'], degrees)],
  ['skew-y', transformPart(['@skew-y'], degrees)],
  ['translate', transformPart(['@translate-x', '@translate-y'], translation)],
  ['translate-x', transformPart(['@translate-x'], translation)],
  ['translate-y', transformPart(['@translate-y'], translation)],
  ['origin', rest => one('transform-origin', custom(rest))],
  ['cursor', rest => one('cursor', /^[a-z-]+$/.test(rest) ? rest : custom(rest))],
  ['accent', (rest, _negative, colors) => one('accent-color', color(rest, colors))],
  ['caret', (rest, _negative, colors) => one('caret-color', color(rest, colors))],
  ['fill', (rest, _negative, colors) => one('fill', rest === 'none' ? 'none' : color(rest, colors))],
  [
    'stroke',
    (rest, _negative, colors) =>
      /^\d+$/.test(rest) ? { 'stroke-width': rest } : one('stroke', rest === 'none' ? 'none' : color(rest, colors))
  ],
  ['will-change', rest => one('will-change', custom(rest))],
  ['object', rest => one('object-position', custom(rest))]
];

export const FAMILIES: readonly [string, Family][] = FAMILY_LIST.toSorted(([a], [b]) => b.length - a.length);
