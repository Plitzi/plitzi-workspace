import {
  isValidElementId,
  positionalElementId,
  repointIds,
  uniqueElementId
} from '@plitzi/sdk-schema/helpers/elementId';

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

/** An element moved onto a name, and whether that name is the one its document already knew it by. */
export interface ElementRename {
  from: string;
  to: string;
  fromIdRef: boolean;
}

/** The name an element carried beside its id before the id became the name, where it carries a usable one. */
const idRefOf = (element: Schema['flat'][string]): string | undefined => {
  const stored: unknown = element;
  if (!isRecord(stored) || typeof stored.idRef !== 'string' || !isValidElementId(stored.idRef)) {
    return undefined;
  }

  return stored.idRef;
};

/**
 * The schema with every element under a name authoring accepts, and the renames that took.
 *
 * A builder from before an element's id was its name keyed `flat` by a Mongo ObjectId and kept the name apart, in
 * `idRef` — which is what the element's sources and the steps aimed at it were written against. The name is the id
 * now, so it is taken back: `idRef` where the element has one, a positional `<type>-<n>` where its id is not one
 * anything can name. An ObjectId that happens to start with a letter is a valid id and still not the name, which is
 * why carrying an `idRef` is enough on its own. `repointIds` carries every reference along — the same pass a rename in
 * the builder runs — on a copy, since the documents are the caller's.
 */
export const withNamedIds = (schema: Schema): { schema: Schema; renames: ElementRename[] } => {
  const stale = Object.values(schema.flat).filter(element => {
    const idRef = idRefOf(element);

    return idRef ? idRef !== element.id : !isValidElementId(element.id);
  });
  if (stale.length === 0) {
    return { schema, renames: [] };
  }

  const staleIds = new Set(stale.map(element => element.id));
  const taken = new Set(Object.keys(schema.flat).filter(id => !staleIds.has(id)));
  const isTaken = (candidate: string): boolean => taken.has(candidate);
  const renames = stale.map(element => {
    const idRef = idRefOf(element);
    const to = idRef ? uniqueElementId(idRef, isTaken) : positionalElementId(element.definition.type, isTaken);
    taken.add(to);

    return { from: element.id, to, fromIdRef: idRef === to };
  });

  const flat = structuredClone(schema.flat);
  const pages = [...schema.pages];
  repointIds(flat, Object.fromEntries(renames.map(({ from, to }) => [from, to])), pages);

  return { schema: { ...schema, flat, pages }, renames };
};
