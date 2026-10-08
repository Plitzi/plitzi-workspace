/* eslint-disable quotes -- the messages quote code, which reads best in the other quotes */
import { isRecord } from '@plitzi/sdk-shared/helpers/isRecord';

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

type Signatures = { exact: string; near: string; shape: string; outside: string; wiring: string; size: number };

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

/** The element a binding's source is published by — `apiContainer_feed.items` and `feed.items` both name `feed`. */
const providerOf = (flat: Schema['flat'], source: string): string | undefined => {
  const [head] = source.split('.');
  const unprefixed = head.slice(head.indexOf('_') + 1);

  return [head, unprefixed].find(candidate => Object.hasOwn(flat, candidate));
};

const isAncestor = (flat: Schema['flat'], ancestor: string, id: string): boolean => {
  for (
    let at = flat[id].definition.parentId;
    at !== undefined && Object.hasOwn(flat, at);
    at = flat[at].definition.parentId
  ) {
    if (at === ancestor) {
      return true;
    }
  }

  return false;
};

/** A binding that reads a provider above the element it is on: the provider, and how far up it sits. */
type Read = { provider: string; depth: number; source: string };

const signaturesOf = (flat: Schema['flat'], declared: Set<string>): Map<string, Signatures> => {
  const depthOf = new Map<string, number>();
  const depth = (id: string): number => {
    const known = depthOf.get(id);
    if (known !== undefined) {
      return known;
    }

    const parent = flat[id].definition.parentId;
    const value = parent !== undefined && Object.hasOwn(flat, parent) ? depth(parent) + 1 : 0;
    depthOf.set(id, value);

    return value;
  };

  const memo = new Map<string, Signatures>();
  /** The reads of a subtree that leave it: what a copy takes from where it is placed. */
  const leaving = new Map<string, Read[]>();
  const visit = (id: string): Signatures | undefined => {
    const known = memo.get(id);
    if (known) {
      return known;
    }

    if (!Object.hasOwn(flat, id)) {
      return undefined;
    }

    const element: Element = flat[id];

    const { type, items = [], styleSelectors, initialState, interactions, bindings } = element.definition;
    const children = items.flatMap(child => visit(child) ?? []);
    // What its flows do, without their values: copies whose steps differ cannot be one component with props.
    const flows = Object.values(interactions ?? {})
      .map(node => `${node.type}:${node.action}`)
      .sort()
      .join(',');
    const classes = classesKey(styleSelectors, declared);

    // What it reads is part of what it is, and where from: a provider inside the copy is named by how far up it sits
    // (each copy has its own, and one copy would have one), a provider outside it by name — two pagers bound to two
    // lists are not one pager in two places.
    const own: Read[] = [];
    const reads = Object.entries(bindings ?? {}).map(([category, list]) => [
      category,
      list.map(({ id: _id, source, ...binding }) => {
        const provider = providerOf(flat, source);
        const up = provider === undefined ? undefined : depth(id) - depth(provider);
        if (provider === undefined || up === undefined || up <= 0 || !isAncestor(flat, provider, id)) {
          return { ...binding, source };
        }

        own.push({ provider, depth: depth(provider), source });

        return { ...binding, source: `^${String(up)}${source.slice(source.indexOf('.'))}` };
      })
    ]);
    const open = [...own, ...items.flatMap(child => leaving.get(child) ?? [])].filter(read => read.depth < depth(id));
    leaving.set(id, open);
    const outside = stable([...new Set(open.map(read => read.source))].sort());
    // What the copy is wired to, by name: the sources it reads from outside itself and the state keys its flows write.
    // Copies wired to different things are different controls written alike — a menu for the language and one for the
    // level — not one item written again for each row of data.
    const wired = new Set([
      ...Object.values(bindings ?? {})
        .flat()
        .flatMap(({ source }) => (own.some(read => read.source === source) ? [] : [`read:${source}`])),
      ...Object.values(interactions ?? {}).flatMap(node => {
        const key: unknown = isRecord(node.params) ? node.params.key : undefined;

        return typeof key === 'string' ? [`write:${key}`] : [];
      }),
      ...children.flatMap(child => child.wiring.split('\n').filter(Boolean))
    ]);

    const body = `${type}|${stable(element.attributes)}|${stable(initialState?.visibility ?? null)}|${stable(reads)}`;
    const signatures = {
      exact: `${body}|${classes}(${children.map(child => child.exact).join(',')})`,
      near: `${body}(${children.map(child => child.near).join(',')})`,
      shape: `${type}|${classes}|${flows}(${children.map(child => child.shape).join(',')})`,
      outside,
      wiring: [...wired].sort().join('\n'),
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
const groupBy = (ids: string[], signatures: Map<string, Signatures>, key: 'exact' | 'near' | 'shape'): string[][] => {
  const groups = new Map<string, string[]>();
  for (const id of ids) {
    const signature = signatures.get(id);
    if (signature) {
      // A copy that reads from where it is placed is the same copy only where it reads the same thing.
      const value = key === 'shape' ? signature.shape : `${signature[key]}|${signature.outside}`;
      const group = groups.get(value) ?? [];
      group.push(id);
      groups.set(value, group);
    }
  }

  return [...groups.values()].sort((a, b) => (signatures.get(b[0])?.size ?? 0) - (signatures.get(a[0])?.size ?? 0));
};

export const suggestRepeats = (
  schema: Schema,
  style: Style,
  families: readonly (readonly string[])[] = []
): Suggestion[] => {
  const { flat } = schema;
  const pages = new Set(schema.pages);
  const familyOfPage = new Map(families.flatMap((members, family) => members.map(page => [page, family] as const)));
  /**
   * Copies that are the same part of the pages of one `pageFamily`, one on each: its body, written once. Not copies of
   * each other, whatever the document holds — and the family is what the docs ask for pages of one shape.
   */
  const writtenOnce = (ids: readonly string[]): boolean => {
    const roots = ids.map(id => flat[id].definition.rootId);
    const [family] = new Set(roots.map(root => familyOfPage.get(root)));

    return (
      family !== undefined &&
      new Set(roots).size === ids.length &&
      roots.every(root => familyOfPage.get(root) === family)
    );
  };
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
      if (
        fresh.length < 2 ||
        pagesWithIt.size !== fresh.length ||
        sizeOf(fresh[0]) < MIN_CHROME ||
        writtenOnce(fresh)
      ) {
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
      const carried = `${String(fresh.length)} pages carry the same ${type} of ${String(size)} elements (${named(fresh)}).`;
      // Pages that already share a layout and only some of them carry the block: it is a part of those pages, not the
      // frame of all of them — one component placed on each, rather than a layout of its own for a few.
      const layouts = new Set([...pagesWithIt].map(page => flat[page].attributes.layout));
      const [only] = layouts;
      const layout = layouts.size === 1 && typeof only === 'string' && only !== '' ? only : undefined;
      const sharing = layout ? schema.pages.filter(page => flat[page].attributes.layout === layout).length : 0;
      suggestions.push(
        sharing > pagesWithIt.size
          ? {
              code: 'repeated-on-pages',
              elementIds: fresh,
              saves: (fresh.length - 1) * size - fresh.length,
              message:
                `${carried} The pages share the layout "${layout}" and only ${String(fresh.length)} of its ` +
                `${String(sharing)} pages carry it, so it is a part of them, not their frame: make it a component — ` +
                '`components: [{ id, root }]` — placed with `component(id)` on each, one tree to read and edit.' +
                onlyClasses
            }
          : {
              code: 'repeated-on-pages',
              elementIds: fresh,
              saves: (fresh.length - 1) * size,
              message:
                `${carried} Write it once in a layout — \`layouts: [{ id, body: [ … it, container({ id: slot }) … ] }]\` ` +
                `— and give each page \`layout: { id, slot }\`: every page then holds only its content.${onlyClasses}`
            }
      );
      fresh.forEach(cover);
    }
  }

  // Copies of one structure saying different things: a component, or a list when they are siblings.
  const everywhere = Object.keys(flat).filter(id => !pages.has(id) && flat[id].definition.type !== 'layoutContainer');
  for (const group of groupBy(everywhere, signatures, 'shape')) {
    const fresh = group.filter(id => !isCovered(id));
    const size = sizeOf(group[0]);
    if (size < MIN_SHAPE || fresh.length < (size >= MIN_PAIR ? 2 : MIN_SHAPE_COPIES) || writtenOnce(fresh)) {
      continue;
    }

    const parents = new Set(fresh.map(id => flat[id].definition.parentId));
    const siblings = parents.size === 1;
    // Side by side but wired to different sources or state keys: controls that look alike, not rows of one list.
    if (siblings && new Set(fresh.map(id => signatures.get(id)?.wiring)).size > 1) {
      continue;
    }

    const type = flat[fresh[0]].definition.type;
    suggestions.push({
      code: 'repeated-shape',
      elementIds: fresh,
      saves: siblings ? (fresh.length - 1) * size : (fresh.length - 1) * size - fresh.length,
      message: siblings
        ? `${String(fresh.length)} ${type}s of ${String(size)} elements side by side (${named(fresh)}) are one ` +
          'item written again for each row of data. One `list` over the rows draws them: its item template is ' +
          'written once and reads each row (`{{ <list>.item.<field> }}`). Worth it when they are data — an array ' +
          'they were written from, rows that come and go; a few cards a person edits word by word on the canvas can ' +
          'stay as they are.'
        : `${String(fresh.length)} ${type}s of ${String(size)} elements share one structure (${named(fresh)}) and ` +
          'differ only in what they say. Make it a component — `components: [{ id, props, root }]` — and place it ' +
          'with `component(id, { props })`: one tree to read and edit, and every copy changes with it. What a copy ' +
          "says or does differently is a prop: an attribute reads `{{ props.title }}`, and so does a flow's step; " +
          'what it reads from the page is a prop the instance binds (`component(id, { bind: [{ to: prop, source }] })`).'
    });
    fresh.forEach(cover);
  }

  return suggestions;
};
