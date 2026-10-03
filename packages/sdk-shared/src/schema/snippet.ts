import { isRecord } from '../helpers/isRecord';

import type { Snippet } from '../types';

/**
 * Whether a document read from somewhere — an upload, a file on a CDN — is a snippet a builder can show and drop: a
 * name, a base element that is in its elements, and a style to dress them. Its shape only; whether what it holds is
 * sound is `validateSnippet`'s to say (`@plitzi/sdk-authoring`).
 */
export const isSnippet = (value: unknown): value is Snippet => {
  if (!isRecord(value) || !isRecord(value.definition) || !isRecord(value.schema) || !isRecord(value.style)) {
    return false;
  }

  const { definition, schema, style } = value;
  if (typeof definition.name !== 'string' || typeof definition.baseElementId !== 'string') {
    return false;
  }

  return (
    isRecord(schema.flat) &&
    isRecord(schema.flat[definition.baseElementId]) &&
    Array.isArray(schema.variables) &&
    isRecord(style.platform)
  );
};
