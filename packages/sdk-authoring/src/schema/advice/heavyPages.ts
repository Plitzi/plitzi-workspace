import { pageLayouts } from '@plitzi/sdk-shared/schema';

import { declaredClasses } from './declaredClasses';
import { signaturesOf } from './repeats';

import type { Suggestion } from './types';
import type { Element, Schema, Style } from '@plitzi/sdk-shared';

/**
 * A page whose part of the document is heavy — every visitor downloads it before the page is theirs — and the shapes
 * written again most inside it, by what they weigh: one of them as a `list` or a component is the document holding one
 * copy where it holds a dozen.
 */

/** Past this, a page's elements weigh more than the rest of a typical page's download. */
export const HEAVY_PAGE_BYTES = 250_000;

const kilobytes = (bytes: number): string => `${String(Math.round(bytes / 1000))} KB`;

/** What 10,000 visits that each download `bytes` move, before compression: the scale a reader weighs a page at. */
const atVolume = (bytes: number): string => {
  const total = bytes * 10_000;

  return total >= 1e9 ? `${(total / 1e9).toFixed(1)} GB` : `${String(Math.round(total / 1e6))} MB`;
};

const count = (value: number): string => value.toLocaleString('en-US');

const subtreeOf = (flat: Schema['flat'], root: string): string[] => {
  const ids: string[] = [];
  const stack = [root];
  while (stack.length > 0) {
    const id = stack.pop();
    if (id === undefined || !Object.hasOwn(flat, id)) {
      continue;
    }

    ids.push(id);
    // In the document's order: the first copy named is the first a reader meets.
    stack.push(...[...(flat[id].definition.items ?? [])].reverse());
  }

  return ids;
};

export const suggestHeavyPages = (schema: Schema, style: Style): Suggestion[] => {
  const { flat } = schema;
  const signatures = signaturesOf(flat, declaredClasses(style));
  const bytesOf = (id: string): number => JSON.stringify(flat[id]).length;

  return schema.pages.flatMap(page => {
    const ids = subtreeOf(flat, page);
    const bytes = ids.reduce((sum, id) => sum + bytesOf(id), 0);
    if (bytes <= HEAVY_PAGE_BYTES) {
      return [];
    }

    // Copies by shape, each weighed whole: a copy's subtree, times the copies beyond the first.
    const shapes = new Map<string, string[]>();
    for (const id of ids) {
      const shape = signatures.get(id)?.shape;
      if (shape !== undefined && (signatures.get(id)?.size ?? 0) > 1) {
        shapes.set(shape, [...(shapes.get(shape) ?? []), id]);
      }
    }

    // A shape whose every copy sits inside a copy of another is weighed in that one: the outermost say where it is.
    const repeated = [...shapes.values()].filter(copies => copies.length > 1);
    const copyOf = new Map(repeated.flatMap(copies => copies.map(copy => [copy, copies] as const)));
    const inside = (copy: string, copies: string[]): boolean => {
      let up = flat[copy].definition.parentId;
      while (up !== undefined && up !== page && Object.hasOwn(flat, up)) {
        const outer = copyOf.get(up);
        if (outer !== undefined && outer !== copies) {
          return true;
        }

        up = flat[up].definition.parentId;
      }

      return false;
    };
    const weighed = repeated
      .filter(copies => !copies.every(copy => inside(copy, copies)))
      .map(copies => ({
        copies,
        bytes: copies.reduce((sum, copy) => sum + subtreeOf(flat, copy).reduce((all, id) => all + bytesOf(id), 0), 0)
      }))
      .sort((a, b) => b.bytes - a.bytes)
      .slice(0, 3);

    const named = weighed.map(
      shape => `"${shape.copies[0]}" ×${String(shape.copies.length)} (${kilobytes(shape.bytes)})`
    );

    return [
      {
        code: 'heavy-page' as const,
        message:
          `Page "${page}" is ${kilobytes(bytes)} of document, past ${kilobytes(HEAVY_PAGE_BYTES)}: every visitor downloads it before the page is theirs — ${atVolume(bytes)} for every 10,000 visits, before compression.` +
          (named.length > 0
            ? ` Written again most: ${named.join(', ')}.`
            : ' No shape repeats in it: its parts are each written once.'),
        elementIds: [page, ...weighed.map(shape => shape.copies[0])],
        saves: weighed.reduce(
          (sum, shape) => sum + (shape.copies.length - 1) * (signatures.get(shape.copies[0])?.size ?? 0),
          0
        )
      }
    ];
  });
};

/**
 * A layout whose own part of the document is heavy: every page drawn in it downloads it — the first a visitor opens, at
 * least — whatever the page itself weighs.
 */
export const suggestHeavyLayouts = (schema: Schema): Suggestion[] => {
  const { flat } = schema;
  const users = new Map<string, number>();
  schema.pages.forEach(page =>
    pageLayouts(flat, page).forEach(layout => users.set(layout, (users.get(layout) ?? 0) + 1))
  );

  return [...users.entries()].flatMap(([layout, pages]) => {
    const bytes = subtreeOf(flat, layout).reduce((sum, id) => sum + JSON.stringify(flat[id]).length, 0);
    if (bytes <= HEAVY_PAGE_BYTES) {
      return [];
    }

    return [
      {
        code: 'heavy-layout' as const,
        message:
          `Layout "${layout}" is ${kilobytes(bytes)} of document, past ${kilobytes(HEAVY_PAGE_BYTES)}: each of its ${count(pages)} ${pages === 1 ? 'page' : 'pages'} is downloaded with it — ${atVolume(bytes)} for every 10,000 first visits, before compression.` +
          ' What only some of its pages show belongs in those pages (or a component they place), not in the shell all of them carry.',
        elementIds: [layout],
        saves: 0
      }
    ];
  });
};

/**
 * Past this many elements built as a page opens — its own, its layouts', its components' — a phone spends longer
 * building and laying out the page than downloading it: Lighthouse flags a page past about 1,400. Generous on purpose:
 * a rich page is a choice, and this only names the ones far past what a visitor's device handles well.
 */
export const MANY_ELEMENTS = 1_500;

const textOf = (value: unknown): string => (typeof value === 'string' ? value : '');

/** Starts hidden and is built only when shown (`loadStrategy` `lazy` or `visible`): nothing of it is built as the page opens. */
const deferred = (element: Element): boolean =>
  element.definition.initialState?.visibility === false &&
  (element.definition.loadStrategy === 'lazy' || element.definition.loadStrategy === 'visible');

/** Shown or hidden by a condition (`visible: { source, template }`, a visibility binding): it may be on screen at once. */
const conditional = (element: Element): boolean =>
  (element.definition.bindings?.initialState ?? []).some(binding => binding.to === 'visibility');

/**
 * Hidden until something shows it — `visible: false`, no condition: a panel or a dialog a click opens — and built as the
 * page opens all the same (`eager`, the default). One hidden by a condition is not named: the condition may hold on the
 * first paint (a board's workspace, shown once its board is read on the server), and deferring it saves nothing.
 */
const hiddenEager = (element: Element): boolean =>
  element.definition.initialState?.visibility === false &&
  !conditional(element) &&
  !deferred(element) &&
  (element.definition.items ?? []).length > 0;

type Built = { total: number; hiddenEager: { id: string; elements: number }[] };

/**
 * The elements a root builds as a page opens: each one under it, a component's every element once per instance placed,
 * an element a `reference` copies with what is under it — but nothing under one that starts hidden and waits to be
 * shown to be built. A `list` is counted once: how many rows it draws is the data's, not the document's.
 */
const builtUnder = (
  schema: Schema,
  flat: Schema['flat'],
  root: string,
  seen: ReadonlySet<string> = new Set()
): Built => {
  const built: Built = { total: 0, hiddenEager: [] };
  const walk = (id: string, within: Schema['flat'], path: ReadonlySet<string>): number => {
    const element = within[id] as Element | undefined;
    if (!element) {
      return 0;
    }

    if (deferred(element)) {
      return 1;
    }

    let total = 1;
    const referenceId = textOf(element.attributes.referenceId);
    if (element.definition.type === 'reference' && referenceId && !path.has(referenceId)) {
      const component = element.attributes.referenceType === 'component' ? schema.components[referenceId] : undefined;
      const deeper = new Set([...path, referenceId]);
      total += component ? walk(component.rootId, component.flat, deeper) : walk(referenceId, flat, deeper);
    }

    const children = (element.definition.items ?? []).reduce((sum, item) => sum + walk(item, within, path), 0);
    total += children;
    if (within === flat && hiddenEager(element) && children > 0) {
      built.hiddenEager.push({ id, elements: children });
    }

    return total;
  };
  built.total = walk(root, flat, seen);

  return built;
};

/**
 * A page that builds more elements as it opens than a phone handles well: how many, where they are, what a visit
 * downloads for them — and, for those that start hidden and are built all the same, the one change that defers them.
 */
export const suggestManyElements = (schema: Schema): Suggestion[] => {
  const { flat } = schema;

  return schema.pages.flatMap(page => {
    const own = builtUnder(schema, flat, page);
    const layouts = pageLayouts(flat, page).map(layout => ({ layout, built: builtUnder(schema, flat, layout) }));
    const total = own.total + layouts.reduce((sum, each) => sum + each.built.total, 0);
    if (total <= MANY_ELEMENTS) {
      return [];
    }

    const bytes = [page, ...layouts.map(each => each.layout)].reduce(
      (sum, root) => sum + subtreeOf(flat, root).reduce((all, id) => all + JSON.stringify(flat[id]).length, 0),
      0
    );
    const hidden = [...own.hiddenEager, ...layouts.flatMap(each => each.built.hiddenEager)]
      .sort((a, b) => b.elements - a.elements)
      .slice(0, 3);
    const shells = layouts
      .filter(each => each.built.total > 0)
      .map(each => `${count(each.built.total)} of layout "${each.layout}"`);

    return [
      {
        code: 'many-elements' as const,
        message:
          `Page "${page}" builds ${count(total)} elements as it opens${shells.length > 0 ? ` (${count(own.total)} of its own, ${shells.join(', ')})` : ''}, past ${count(MANY_ELEMENTS)}: a phone builds, styles and lays out every one before the page answers, and a list adds its rows on top. ` +
          `A visit downloads ${kilobytes(bytes)} of document for them — ${atVolume(bytes)} for every 10,000 visits, before compression.` +
          (hidden.length > 0
            ? ` Built though they start hidden: ${hidden.map(each => `"${each.id}" (${count(each.elements)})`).join(', ')} — \`loadStrategy: 'lazy'\` builds each the first time it is shown.`
            : ''),
        elementIds: [page, ...hidden.map(each => each.id)],
        saves: 0
      }
    ];
  });
};
