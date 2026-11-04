import { createHash } from 'node:crypto';

import { styleSheetCss, styleSheetHref, styleSheetLinkable } from '@plitzi/sdk-shared/style';

import { escapeJson } from './escapeJson';

import type { CompressedBodies, OfflineDataRaw, Schema, Style } from '@plitzi/sdk-shared';

/** The space as a page reads it, the name of exactly that text, and the space it was written from. */
export type SpaceDocument = { json: string; hash: string; data: OfflineDataRaw };

/** A space's compiled stylesheet as a file of its own: its text, its name, and the compressed forms sent of it. */
export type StyleSheet = { css: string; hash: string; href: string; compressed: CompressedBodies };

export const digest = (text: string): string => createHash('sha256').update(text).digest('base64url').slice(0, 22);

const sent = new WeakMap<OfflineDataRaw, WeakMap<Schema, OfflineDataRaw>>();

/**
 * The space with `schema` — the one a visitor is sent, some pages withheld (`withholdPages`) — as the same object for
 * every visitor sent that schema. Everything kept by the object is kept for them too: a new one each render made the
 * page's document be written, escaped and hashed again for every visit to a space with one protected page (a quarter
 * of what the docs' pages cost, measured). `schema` is the space's own when nothing is withheld, and the space is
 * answered as it came.
 */
export const offlineDataWith = (offlineData: OfflineDataRaw, schema: Schema): OfflineDataRaw => {
  if (schema === offlineData.schema) {
    return offlineData;
  }

  const copies = sent.get(offlineData) ?? new WeakMap<Schema, OfflineDataRaw>();
  sent.set(offlineData, copies);
  const known = copies.get(schema);
  if (known) {
    return known;
  }

  const copy = { ...offlineData, schema };
  copies.set(schema, copy);

  return copy;
};

const sheets = new WeakMap<Style, StyleSheet | null>();

/**
 * The space's stylesheet as a file — made once per style object, which the adapters hand every render until the
 * space changes, and which a page's withheld copy of the space shares — or `undefined` when it stays in the page
 * (`styleSheetLinkable`).
 */
export const styleSheetOf = (offlineData: OfflineDataRaw): StyleSheet | undefined => {
  const known = sheets.get(offlineData.style);
  if (known !== undefined) {
    return known ?? undefined;
  }

  if (!styleSheetLinkable(offlineData.style.cache)) {
    sheets.set(offlineData.style, null);

    return undefined;
  }

  const css = styleSheetCss(offlineData.style.cache);
  const hash = digest(css);
  const sheet = { css, hash, href: styleSheetHref(hash), compressed: {} };
  sheets.set(offlineData.style, sheet);

  return sheet;
};

const linked = new WeakMap<OfflineDataRaw, SpaceDocument>();
const carried = new WeakMap<OfflineDataRaw, SpaceDocument>();

/**
 * The space as the page reads it — escaped JSON, safe inside a `<script>` — made once per space object rather than
 * once per render.
 *
 * It is most of the payload, and the adapters hand every request the same object until the space changes, so turning
 * it into JSON on each render was a tenth of a render's CPU spent producing the same string. Keyed weakly: a space the
 * adapters let go of takes its string with it.
 *
 * `linkStyle`, the compiled stylesheet is a file the page links (`styleSheetOf`): the document names it as
 * `style.cacheHref` and carries none of it. Without, the page carries it — a page no other request could answer the
 * file for: a draft, a space named by a token.
 *
 * The hash names the text, so a page can be told where to fetch it and the answer can be kept forever.
 */
export const spaceDocument = (offlineData: OfflineDataRaw, { linkStyle = true }: { linkStyle?: boolean } = {}) => {
  const documents = linkStyle ? linked : carried;
  const known = documents.get(offlineData);
  if (known) {
    return known;
  }

  const sheet = linkStyle ? styleSheetOf(offlineData) : undefined;
  const data = sheet
    ? { ...offlineData, style: { ...offlineData.style, cache: '', cacheHref: sheet.href } }
    : offlineData;
  const json = escapeJson(JSON.stringify(data));
  const document: SpaceDocument = { json, hash: digest(json), data };
  documents.set(offlineData, document);

  return document;
};

/**
 * What the page's bootstrap reads: `{ offlineData, ...rest }` as escaped JSON, byte for byte what serializing the
 * whole object would give. The escaping replaces characters one by one, so escaping the parts and joining them is
 * the same as escaping the whole.
 *
 * `apart`, the space is not in it: the page fetches it (`spaceDocumentPath`), and only what is this request's travels
 * inline.
 */
export const hydrationPayload = (
  offlineData: OfflineDataRaw | undefined,
  rest: Record<string, unknown>,
  { apart = false, linkStyle = true }: { apart?: boolean; linkStyle?: boolean } = {}
): string => {
  const serializedRest = escapeJson(JSON.stringify(rest));
  if (offlineData === undefined || apart) {
    return serializedRest;
  }

  const separator = serializedRest === '{}' ? '' : ',';

  return `{"offlineData":${spaceDocument(offlineData, { linkStyle }).json}${separator}${serializedRest.slice(1)}`;
};
