import type { Schema } from '@plitzi/sdk-shared';

/**
 * The parts of a document an older builder may not have written at all, read without trusting the type.
 *
 * The types describe what a document IS today. A document from before a field existed simply lacks it, and reading it
 * through the type would promise a value that is not there — so these read it as what it really is, `unknown`.
 */

export const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

/** The space's name and URL, where the document carries them. An older export carries no definition at all. */
export const definitionOf = (schema: Schema): { name?: string; permanentUrl?: string } => {
  const definition: unknown = schema.definition;
  if (!isRecord(definition)) {
    return {};
  }

  return {
    ...(typeof definition.name === 'string' ? { name: definition.name } : {}),
    ...(typeof definition.permanentUrl === 'string' ? { permanentUrl: definition.permanentUrl } : {})
  };
};

/** A schema variable's category, which a document with none writes as null where the type wants text. */
export const categoryOf = (variable: Schema['variables'][number]): string => {
  const category: unknown = variable.category;

  return typeof category === 'string' ? category : '';
};
