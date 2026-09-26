import { isOneOf } from './values.ts';
import {
  BRUSHES,
  DASHES,
  EDGES,
  FILL_STYLES,
  FILLS,
  OPACITIES,
  SLOPPINESS,
  STROKES,
  STROKE_WIDTHS,
  takesStyle
} from '../../board/model.ts';

import type { BoardElement, StyleField } from '../../board/model.ts';

/**
 * How an element is styled, one field at a time — what the style panel offers, what a restyle writes, and what the
 * selection reports back, from one table.
 *
 * The optional fields are kept only when they differ from their plain value: a solid, artist-drawn, sharp-cornered,
 * hatched, opaque shape in Pizarra's own ink carries none of them, so every board drawn before they existed is exactly
 * as it was.
 */

/** A style choice, as the page names it — `solid`, `artist`, `sharp`, `hachure`, `100` and `pizarra` are the plain ones. */
export type StyleChoice = Partial<Record<StyleField, string>>;

const PLAIN = {
  dash: 'solid',
  sloppiness: 'artist',
  edges: 'sharp',
  fillStyle: 'hachure',
  opacity: '100',
  brush: 'pizarra'
} as const;

/** Every field, in the order the panel shows them. */
export const STYLE_FIELDS: readonly StyleField[] = [
  'stroke',
  'fill',
  'fillStyle',
  'strokeWidth',
  'dash',
  'sloppiness',
  'edges',
  'brush',
  'opacity'
];

/** One value per field, from a function of the field — every field named, so the record is whole by construction. */
export const byField = <T>(value: (field: StyleField) => T): Record<StyleField, T> => ({
  stroke: value('stroke'),
  fill: value('fill'),
  fillStyle: value('fillStyle'),
  strokeWidth: value('strokeWidth'),
  dash: value('dash'),
  sloppiness: value('sloppiness'),
  edges: value('edges'),
  brush: value('brush'),
  opacity: value('opacity')
});

/** A choice as a flow sends it — each field a string or a number, anything else ignored. */
export const choiceFrom = (params: Record<string, unknown>): StyleChoice =>
  Object.fromEntries(
    STYLE_FIELDS.flatMap(field => {
      const value = params[field];

      return typeof value === 'string' || typeof value === 'number' ? [[field, String(value)]] : [];
    })
  );

/** What an element is drawn with for one field, as the page names it. */
export const styleOf = (element: BoardElement, field: StyleField): string => {
  switch (field) {
    case 'stroke':
      return element.stroke;
    case 'fill':
      return element.fill;
    case 'strokeWidth':
      return String(element.strokeWidth);
    case 'dash':
      return element.dash ?? PLAIN.dash;
    case 'sloppiness':
      return element.sloppiness ?? PLAIN.sloppiness;
    case 'edges':
      return element.edges ?? PLAIN.edges;
    case 'fillStyle':
      return element.fillStyle ?? PLAIN.fillStyle;
    case 'opacity':
      return String(element.opacity ?? PLAIN.opacity);
    case 'brush':
      return element.brush ?? PLAIN.brush;
  }
};

/** An element with one field set to a choice — unchanged when the choice is not one of that field's. */
const withField = (element: BoardElement, field: StyleField, value: string): BoardElement => {
  const { dash, sloppiness, edges, fillStyle, opacity, brush, ...plain } = element;
  const kept = { dash, sloppiness, edges, fillStyle, opacity, brush };
  const optional = (next: Partial<typeof kept>): BoardElement => {
    const merged = { ...kept, ...next };

    return {
      ...plain,
      ...(merged.dash ? { dash: merged.dash } : {}),
      ...(merged.sloppiness ? { sloppiness: merged.sloppiness } : {}),
      ...(merged.edges ? { edges: merged.edges } : {}),
      ...(merged.fillStyle ? { fillStyle: merged.fillStyle } : {}),
      ...(merged.opacity ? { opacity: merged.opacity } : {}),
      ...(merged.brush ? { brush: merged.brush } : {})
    };
  };
  const width = Number(value);
  const percent = Number(value);

  switch (field) {
    case 'stroke':
      return isOneOf(STROKES, value) ? { ...element, stroke: value } : element;
    case 'fill':
      return isOneOf(FILLS, value) ? { ...element, fill: value } : element;
    case 'strokeWidth': {
      if (!isOneOf(STROKE_WIDTHS, width)) {
        return element;
      }

      // S, M or L on a resized text: the size it was dragged to gives way to the one picked.
      const { fontSize: _dragged, ...sized } = element;

      return { ...sized, strokeWidth: width };
    }
    case 'dash':
      return value === PLAIN.dash || isOneOf(DASHES, value)
        ? optional({ dash: value === PLAIN.dash ? undefined : value })
        : element;
    case 'sloppiness':
      return value === PLAIN.sloppiness || isOneOf(SLOPPINESS, value)
        ? optional({ sloppiness: value === PLAIN.sloppiness ? undefined : value })
        : element;
    case 'edges':
      return value === PLAIN.edges || isOneOf(EDGES, value)
        ? optional({ edges: value === PLAIN.edges ? undefined : value })
        : element;
    case 'fillStyle':
      return value === PLAIN.fillStyle || isOneOf(FILL_STYLES, value)
        ? optional({ fillStyle: value === PLAIN.fillStyle ? undefined : value })
        : element;
    case 'opacity':
      return value === PLAIN.opacity || isOneOf(OPACITIES, percent)
        ? optional({ opacity: value === PLAIN.opacity ? undefined : isOneOf(OPACITIES, percent) ? percent : undefined })
        : element;
    case 'brush':
      return value === PLAIN.brush || isOneOf(BRUSHES, value)
        ? optional({ brush: value === PLAIN.brush ? undefined : value })
        : element;
  }
};

/**
 * An element restyled with what it takes of a choice, and nothing else: a note keeps no outline, a picture only its
 * opacity — and paper is never "no fill".
 */
export const restyled = (element: BoardElement, choice: StyleChoice): BoardElement =>
  STYLE_FIELDS.reduce((next, field) => {
    const value = choice[field];
    const paper = element.type === 'sticky' || element.type === 'stack';
    if (value === undefined || value === '' || !takesStyle(element.type, field) || (paper && value === 'none')) {
      return next;
    }

    return withField(next, field, value);
  }, element);
