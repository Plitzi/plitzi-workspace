/* eslint-disable quotes -- the messages quote code, which reads best in the other quotes */
import { declaredClasses } from './declaredClasses';

import type { Suggestion } from './types';
import type { Element, Schema, Style } from '@plitzi/sdk-shared';

/**
 * The same thing written more than once — the copies an author made by hand, or by calling a helper per page.
 *
 * Read as subtrees: every element's tree is given three signatures, bottom-up, and the trees that share one are copies
 * of each other in that sense —
 *
 * - `exact`: the same elements with the same attributes and classes. On several pages, that is chrome a layout holds
 *   once.
 * - `near`: the same, except for the classes. On several pages, that is chrome where one item is styled per page —
 *   nearly always the navigation's link to the page being shown, which the `current` state marks by itself.
 * - `shape`: the same elements and classes, whatever they say. Three or more of them are a component, or a list.
 *
 * Only the largest copy is reported: a footer repeated on four pages is one suggestion, not one per element in it.
 */

/** Smaller than this, a copy costs less than the layout or component that would hold it. */
const MIN_CHROME = 5;
const MIN_SHAPE = 4;
const MIN_SHAPE_COPIES = 3;
/** Two copies are worth a component only when each is this large. */
const MIN_PAIR = 8;

type Signatures = { exact: string; near: string; shape: string; size: number };

/** A key for a value, the same whatever order its object keys were written in. */
const stable = (value: unknown): string => {
  if (Array.isArray(value)) {
    return `[${value.map(stable).join(',')}]`;
  }

  if (typeof value === 'object' && value !== null) {
    return `{${Object.keys(value)
      .sort()
      .map(key => `${key}:${stable(Reflect.get(value, key))}`)
      .join(',')}}`;
  }

  // `JSON.stringify(undefined)` is undefined, whatever its type says: an attribute left unset is a value of its own.
  return value === undefined ? 'undefined' : JSON.stringify(value);
};

/**
 * The space's own classes an element wears, per selector. An element with no class of its own is given one generated
 * from its id (`heading-10b9`), different on every copy — counting those, no two copies would ever match.
 */
const classesKey = (styleSelectors: Element['definition']['styleSelectors'], declared: Set<string>): string =>
  stable(
    Object.fromEntries(
      Object.entries(styleSelectors).map(([selector, value]) => [
        selector,
        value
          .split(/\s+/)
          .filter(name => declared.has(name))
          .join(' ')
      ])
    )
  );

const signaturesOf = (flat: Schema['flat'], declared: Set<string>): Map<string, Signatures> => {
  const memo = new Map<string, Signatures>();
  const visit = (id: string): Signatures | undefined => {
    const known = memo.get(id);
    if (known) {
      return known;
    }

    if (!Object.hasOwn(flat, id)) {
      return undefined;
    }

    const element: Element = flat[id];

    const { type, items = [], styleSelectors, initialState, interactions } = element.definition;
    const children = items.flatMap(child => visit(child) ?? []);
    // What its flows do, without their values: copies whose steps differ cannot be one component with props.
    const flows = Object.values(interactions ?? {})
      .map(node => `${node.type}:${node.action}`)
      .sort()
      .join(',');
    const classes = classesKey(styleSelectors, declared);
    const own = `${type}|${stable(element.attributes)}|${stable(initialState?.visibility ?? null)}`;
    const signatures = {
      exact: `${own}|${classes}(${children.map(child => child.exact).join(',')})`,
      near: `${own}(${children.map(child => child.near).join(',')})`,
      shape: `${type}|${classes}|${flows}(${children.map(child => child.shape).join(',')})`,
      size: 1 + children.reduce((sum, child) => sum + child.size, 0)
    };
    memo.set(id, signatures);

    return signatures;
  };

  Object.keys(flat).forEach(visit);

  return memo;
};

const named = (ids: string[]): string => {
  const shown = ids.slice(0, 3).map(id => `"${id}"`);

  return ids.length > 3 ? `${shown.join(', ')} and ${String(ids.length - 3)} more` : shown.join(', ');
};

/** Elements grouped by one of their signatures, the largest trees first. */
const groupBy = (
  ids: string[],
  signatures: Map<string, Signatures>,
  key: keyof Omit<Signatures, 'size'>
): string[][] => {
  const groups = new Map<string, string[]>();
  for (const id of ids) {
    const signature = signatures.get(id);
    if (signature) {
      const group = groups.get(signature[key]) ?? [];
      group.push(id);
      groups.set(signature[key], group);
    }
  }

  return [...groups.values()].sort((a, b) => (signatures.get(b[0])?.size ?? 0) - (signatures.get(a[0])?.size ?? 0));
};

export const suggestRepeats = (schema: Schema, style: Style): Suggestion[] => {
  const { flat } = schema;
  const pages = new Set(schema.pages);
  const signatures = signaturesOf(flat, declaredClasses(style));
  const sizeOf = (id: string): number => signatures.get(id)?.size ?? 0;
  const inPages = Object.keys(flat).filter(id => pages.has(flat[id].definition.rootId) && !pages.has(id));

  /** Every element under one already reported is part of that suggestion, not a suggestion of its own. */
  const covered = new Set<string>();
  const cover = (id: string): void => {
    covered.add(id);
    if (Object.hasOwn(flat, id)) {
      flat[id].definition.items?.forEach(cover);
    }
  };

  const isCovered = (id: string): boolean => {
    for (let at: string | undefined = id; at; at = Object.hasOwn(flat, at) ? flat[at].definition.parentId : undefined) {
      if (covered.has(at)) {
        return true;
      }
    }

    return false;
  };

  /**
   * Whether a block sits at the edge of its page — first or last at every level up to the page — which is where a
   * layout can hold it: the page's own content then goes in a slot before or after it. A block between two parts of
   * a page's content is not chrome, whatever it repeats.
   */
  const atEdge = (id: string): boolean => {
    for (let at = id; !pages.has(at);) {
      const parent = flat[at].definition.parentId;
      if (parent === undefined || !Object.hasOwn(flat, parent)) {
        return false;
      }

      const siblings = flat[parent].definition.items ?? [];
      if (siblings[0] !== at && siblings.at(-1) !== at) {
        return false;
      }

      at = parent;
    }

    return true;
  };

  const suggestions: Suggestion[] = [];

  // Chrome: one copy per page, on several pages. Exact copies first; then the ones that differ only in a class.
  for (const key of ['exact', 'near'] as const) {
    for (const group of groupBy(inPages, signatures, key)) {
      const fresh = group.filter(id => !isCovered(id) && atEdge(id));
      const pagesWithIt = new Set(fresh.map(id => flat[id].definition.rootId));
      if (fresh.length < 2 || pagesWithIt.size !== fresh.length || sizeOf(fresh[0]) < MIN_CHROME) {
        continue;
      }

      const size = sizeOf(fresh[0]);
      const type = flat[fresh[0]].definition.type;
      const onlyClasses =
        key === 'near'
          ? ' They differ only in their classes — nearly always the link to the page being shown: a link marks ' +
            'its own page by itself, so its class says how with `states: { current: { … } }` (or `activeOn` for an ' +
            'entry lit on several pages), and the copies become one.'
          : '';
      suggestions.push({
        code: 'repeated-on-pages',
        elementIds: fresh,
        saves: (fresh.length - 1) * size,
        message:
          `${String(fresh.length)} pages carry the same ${type} of ${String(size)} elements (${named(fresh)}). ` +
          'Write it once in a layout — `layouts: [{ id, body: [ … it, container({ id: slot }) … ] }]` — and give each ' +
          `page \`layout: { id, slot }\`: every page then holds only its content.${onlyClasses}`
      });
      fresh.forEach(cover);
    }
  }

  // Copies of one structure saying different things: a component, or a list when they are siblings.
  const everywhere = Object.keys(flat).filter(id => !pages.has(id) && flat[id].definition.type !== 'layoutContainer');
  for (const group of groupBy(everywhere, signatures, 'shape')) {
    const fresh = group.filter(id => !isCovered(id));
    const size = sizeOf(group[0]);
    if (size < MIN_SHAPE || fresh.length < (size >= MIN_PAIR ? 2 : MIN_SHAPE_COPIES)) {
      continue;
    }

    const parents = new Set(fresh.map(id => flat[id].definition.parentId));
    const siblings = parents.size === 1;
    const type = flat[fresh[0]].definition.type;
    suggestions.push({
      code: 'repeated-shape',
      elementIds: fresh,
      saves: siblings ? (fresh.length - 1) * size : (fresh.length - 1) * size - fresh.length,
      message: siblings
        ? `${String(fresh.length)} ${type}s of ${String(size)} elements side by side (${named(fresh)}) are one ` +
          'item written again for each row of data. One `list` over the rows draws them: its item template is ' +
          'written once and reads each row (`{{ <list>.item.<field> }}`).'
        : `${String(fresh.length)} ${type}s of ${String(size)} elements share one structure (${named(fresh)}) and ` +
          'differ only in what they say. Make it a component — `components: [{ id, props, root }]` — and place it ' +
          'with `component(id, { props })`: one tree to read and edit, and every copy changes with it. What a copy ' +
          "says or does differently is a prop: an attribute reads `{{ props.title }}`, and so does a flow's step."
    });
    fresh.forEach(cover);
  }

  return suggestions;
};
