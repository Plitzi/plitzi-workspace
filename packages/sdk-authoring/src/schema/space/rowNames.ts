import type { Element } from '@plitzi/sdk-shared';

/** The elements that repeat their children once per item, each publishing its row under its type: `list_rows`. */
const REPEATERS = new Set(['list', 'carousel', 'table']);

const TEMPLATE = /\{\{|\{%/;

const escaped = (text: string): string => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * Every template of the documents reads a row by the same name a binding does: `rows.item` — `r.item` — written in a
 * template is completed to `list_rows.item`, as a binding's own `source` is at run time. A row had two names, one for a
 * binding and one for a template (`r.inTemplate.item`), and the wrong one was found only when authored (PZ-8).
 *
 * Only a repeater's own `item` and `index`, and only in text that is a template: a name that is not a list's, a carousel's
 * or a table's id is left as written, for the lint to say what it is. A row read outside its repeater is completed too,
 * and then said as out of scope.
 */
export const completeRowNames = (flats: readonly Record<string, Element>[]): void => {
  const repeaters = new Map<string, string>();
  for (const flat of flats) {
    for (const element of Object.values(flat)) {
      if (REPEATERS.has(element.definition.type)) {
        repeaters.set(element.id, element.definition.type);
      }
    }
  }

  if (repeaters.size === 0) {
    return;
  }

  const names = [...repeaters.keys()].sort((a, b) => b.length - a.length).map(escaped);
  // Not after a word, a dot, a `$` or a `-`: `state.rows.item` and `list_rows.item` are other names, left alone.
  const short = new RegExp(`(?<![\\w.$-])(${names.join('|')})\\.(item|index)\\b`, 'g');
  const complete = (text: string): string =>
    TEMPLATE.test(text)
      ? text.replace(short, (_, id: string, field: string) => `${repeaters.get(id) ?? 'list'}_${id}.${field}`)
      : text;
  const walkAny = (value: unknown): unknown => {
    if (typeof value === 'string') {
      return complete(value);
    }

    if (Array.isArray(value)) {
      return value.map(walkAny);
    }

    if (typeof value === 'object' && value !== null) {
      return Object.fromEntries(Object.entries(value).map(([key, inner]) => [key, walkAny(inner)]));
    }

    return value;
  };
  // It rewrites text inside templates and never a shape: what it hands back is what it was handed, its strings
  // completed — the one place the type is restated, as a walk over any value cannot say it.
  const walk = <T>(value: T): T => walkAny(value) as T;

  for (const flat of flats) {
    for (const element of Object.values(flat)) {
      const { definition } = element;
      element.attributes = walk(element.attributes);
      if (definition.bindings !== undefined) {
        definition.bindings = walk(definition.bindings);
      }

      if (definition.interactions !== undefined) {
        definition.interactions = walk(definition.interactions);
      }
    }
  }
};
