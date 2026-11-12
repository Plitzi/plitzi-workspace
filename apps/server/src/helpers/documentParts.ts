import { schemaForPage, splitSchema } from '@plitzi/sdk-shared/schema';

import { escapeJson } from './escapeJson';
import { digest } from './hydrationPayload';

import type { Schema } from '@plitzi/sdk-shared';
import type { DocumentPart, SplitSchema } from '@plitzi/sdk-shared/schema';

/**
 * The space in parts as this server sends it (`splitSchema`): the document a page is sent — the shell with that page's
 * part and its layouts' — and the text of each part, by the name the shell gives it, for the page's next navigations.
 *
 * Kept per schema object, which is the space for one group of visitors (`withholdPages` hands each group the same
 * object, and its `withheld` with it): split and written once, then read. A part's name is its text's hash, so it is
 * kept forever by whoever fetched it, and a changed space names new parts.
 */
type ServedParts = { split: SplitSchema; texts: Map<string, string>; pages: Map<string, Schema> };

const served = new WeakMap<Schema, ServedParts>();

/** A part as it is fetched: its root and its elements, escaped as the document is. */
const textOf = (part: DocumentPart): string => escapeJson(JSON.stringify(part));

const servedOf = (schema: Schema, withheld: readonly string[]): ServedParts => {
  const known = served.get(schema);
  if (known) {
    return known;
  }

  const texts = new Map<string, string>();
  const split = splitSchema(
    schema,
    part => {
      const text = textOf(part);
      const name = digest(text);
      texts.set(name, text);

      return name;
    },
    withheld
  );
  const parts: ServedParts = { split, texts, pages: new Map() };
  served.set(schema, parts);

  return parts;
};

/**
 * Whether this space is sent in parts: unless it asks for the whole (`settings.wholeDocument`), or has a single page —
 * nothing to fetch later, so the shell would only be split for nothing.
 */
export const sentInParts = (schema: Schema): boolean =>
  schema.settings.wholeDocument !== true && schema.pages.length > 1;

/** The schema a page is sent with: the shell, that page's part and its layouts' — the same object for every visit. */
export const pageSchemaOf = (schema: Schema, withheld: readonly string[], pageId: string): Schema => {
  const parts = servedOf(schema, withheld);
  const known = parts.pages.get(pageId);
  if (known) {
    return known;
  }

  const page = schemaForPage(parts.split, pageId);
  parts.pages.set(pageId, page);

  return page;
};

/** A part's text by its name, for this group of visitors; none for a name their shell does not give. */
export const partTextOf = (schema: Schema, withheld: readonly string[], name: string): string | undefined =>
  servedOf(schema, withheld).texts.get(name);
