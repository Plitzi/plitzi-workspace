import type { Suggestion } from './types';
import type { Schema } from '@plitzi/sdk-shared';

/**
 * The same expression written into many bindings, steps or attributes, its numbers and words aside — a price worked out
 * again in every pill of a configurator, what is chosen read again in every row. Each copy is the whole arithmetic, and
 * the document carries it once per copy: the pricing page was 708 KB of it before its sums became computed values
 * (189 KB), the space page's capacity 95 KB.
 */

/** Shorter than this, a template is a reading, not a sum: repeating it costs little and says more than a name would. */
const LONGEST_KEPT = 80;

/** At least this many copies of one shape, weighing at least this much in all, before it is worth a name of its own. */
const COPIES = 8;
const BYTES = 8_000;

const TEMPLATE = /\{\{|\{%/;

/** What a copy shares with the others: its numbers and its quoted words taken out. */
const shapeOf = (template: string): string =>
  template
    .replace(/'(?:[^'\\]|\\.)*'|"(?:[^"\\]|\\.)*"/gu, "''")
    .replace(/\b\d+(?:\.\d+)?\b/gu, '0')
    .replace(/\s+/gu, ' ');

/** Every text of an element that holds a template: its attributes, its bindings' transformers, its steps' params. */
const templatesOf = (value: unknown, found: string[] = []): string[] => {
  if (typeof value === 'string') {
    if (TEMPLATE.test(value)) {
      found.push(value);
    }
  } else if (Array.isArray(value)) {
    for (const each of value) {
      templatesOf(each, found);
    }
  } else if (value !== null && typeof value === 'object') {
    for (const each of Object.values(value)) {
      templatesOf(each, found);
    }
  }

  return found;
};

const kilobytes = (bytes: number): string => `${String(Math.round(bytes / 1000))} KB`;

export const suggestRepeatedExpressions = (schema: Pick<Schema, 'flat'>): Suggestion[] => {
  const shapes = new Map<string, { elements: string[]; bytes: number; first: string }>();
  for (const element of Object.values(schema.flat)) {
    const { attributes, definition } = element;
    for (const template of templatesOf([attributes, definition.bindings, definition.interactions])) {
      if (template.length < LONGEST_KEPT) {
        continue;
      }

      const shape = shapeOf(template);
      const known = shapes.get(shape) ?? { elements: [], bytes: 0, first: template };
      known.elements.push(element.id);
      known.bytes += template.length;
      shapes.set(shape, known);
    }
  }

  return [...shapes.values()]
    .filter(shape => shape.elements.length >= COPIES && shape.bytes >= BYTES)
    .sort((a, b) => b.bytes - a.bytes)
    .map(shape => ({
      code: 'repeated-expression' as const,
      message:
        `The same expression, its numbers and words aside, is written ${String(shape.elements.length)} times (${kilobytes(shape.bytes)}) — first in "${shape.elements[0]}": ${shape.first.slice(0, 90)}${shape.first.length > 90 ? '…' : ''}. ` +
        'What the copies share can be worked out once, as a computed value each copy reads — `null` off the page that reads it — and each keep only what differs; copies that sit side by side can be one `list` whose rows carry what differs.',
      elementIds: [...new Set(shape.elements)],
      saves: 0
    }));
};
