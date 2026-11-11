import { declaredClasses } from './declaredClasses';
import { signaturesOf } from './repeats';

import type { Suggestion } from './types';
import type { Schema, Style } from '@plitzi/sdk-shared';

/**
 * A page whose part of the document is heavy — every visitor downloads it before the page is theirs — and the shapes
 * written again most inside it, by what they weigh: one of them as a `list` or a component is the document holding one
 * copy where it holds a dozen.
 */

/** Past this, a page's elements weigh more than the rest of a typical page's download. */
export const HEAVY_PAGE_BYTES = 250_000;

const kilobytes = (bytes: number): string => `${String(Math.round(bytes / 1000))} KB`;

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
          `Page "${page}" is ${kilobytes(bytes)} of document, past ${kilobytes(HEAVY_PAGE_BYTES)}: every visitor downloads it before the page is theirs.` +
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
