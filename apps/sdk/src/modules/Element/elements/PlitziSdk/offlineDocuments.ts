import { isRecord } from '@plitzi/sdk-shared/helpers/isRecord';

import type { OfflineDataRaw } from '@plitzi/sdk-shared';

export type OfflineDocuments =
  | { documents: OfflineDataRaw }
  /** Bound from two sources, one has not answered yet: nothing to draw, and nothing wrong. */
  | { waiting: ('schema' | 'style')[] }
  | { problem: string };

const shapeProblem = (schema: unknown, style: unknown): string | undefined => {
  if (!isRecord(schema) || !isRecord(schema.flat) || !Array.isArray(schema.pages)) {
    return '`schema` has no `flat` and `pages`';
  }

  if (!isRecord(style) || !isRecord(style.platform) || typeof style.cache !== 'string') {
    return '`style` has no `platform` and compiled `cache`';
  }

  return undefined;
};

// The shape is what the runtime reads before anything else; a document that passes it and is still wrong in its
// content is reported by the space it renders, the way any other space is.
const isOfflineDataRaw = (value: Record<string, unknown>): value is OfflineDataRaw =>
  shapeProblem(value.schema, value.style) === undefined;

/**
 * The documents a `plitziSdk` element was handed, whether they are still on their way, or why they cannot be drawn.
 *
 * They arrive from bindings as often as from an author — an `apiContainer`'s answer whole, or `schema` and `style` from
 * two elements, one answering before the other — so anything may come in, and a half-built value fed to the SDK fails
 * deep inside it, far from the element that was given it.
 */
export const offlineDocuments = (value: unknown): OfflineDocuments => {
  if (!isRecord(value)) {
    return { problem: 'The documents cannot be drawn: they are not an object with `schema` and `style`.' };
  }

  const waiting = (['schema', 'style'] as const).filter(part => value[part] === undefined);
  if (waiting.length > 0) {
    return { waiting };
  }

  if (isOfflineDataRaw(value)) {
    return { documents: value };
  }

  return {
    problem: `The documents cannot be drawn: ${shapeProblem(value.schema, value.style) ?? 'their shape is unknown'}.`
  };
};
