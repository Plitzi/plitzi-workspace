import { createHash } from 'node:crypto';

import { styleCacheTravelsInDocument } from '@plitzi/sdk-shared/style';

import { escapeJson } from './escapeJson';

import type { OfflineDataRaw } from '@plitzi/sdk-shared';

/** The space as a page reads it, and the name of exactly that text. */
export type SpaceDocument = { json: string; hash: string };

const documents = new WeakMap<OfflineDataRaw, SpaceDocument>();

/**
 * The space as the page reads it — escaped JSON, safe inside a `<script>` — made once per space object rather than
 * once per render.
 *
 * It is most of the payload, and the adapters hand every request the same object until the space changes, so turning
 * it into JSON on each render was a tenth of a render's CPU spent producing the same string. Keyed weakly: a space the
 * adapters let go of takes its string with it.
 *
 * The compiled stylesheet is left out when the page's own runtime stylesheet carries it in a form the browser reads
 * back exactly (`styleCacheTravelsInDocument`): it is the largest part of the style document, and the page would
 * otherwise ship it twice. A fact of the space alone, so the document is the same wherever it is asked for.
 *
 * The hash names the text, so a page can be told where to fetch it and the answer can be kept forever.
 */
export const spaceDocument = (offlineData: OfflineDataRaw): SpaceDocument => {
  const known = documents.get(offlineData);
  if (known) {
    return known;
  }

  const space = styleCacheTravelsInDocument(offlineData.style.cache)
    ? { ...offlineData, style: { ...offlineData.style, cache: '' } }
    : offlineData;
  const json = escapeJson(JSON.stringify(space));
  const document = { json, hash: createHash('sha256').update(json).digest('base64url').slice(0, 22) };
  documents.set(offlineData, document);

  return document;
};

/**
 * What the page's bootstrap reads: `{ offlineData, ...rest }` as escaped JSON, byte for byte what serializing the
 * whole object would give. The escaping replaces characters one by one, so escaping the parts and joining them is
 * the same as escaping the whole.
 *
 * `apart`, the space is not in it: the page fetches it (`spaceDocumentPath`), and only what is this request's travels
 * inline. `styleCacheInDocument` tells the bootstrap the stylesheet is in the page either way.
 */
export const hydrationPayload = (
  offlineData: OfflineDataRaw | undefined,
  rest: Record<string, unknown>,
  { apart = false }: { apart?: boolean } = {}
): string => {
  const inDocument = offlineData !== undefined && styleCacheTravelsInDocument(offlineData.style.cache);
  const serializedRest = escapeJson(JSON.stringify(inDocument ? { ...rest, styleCacheInDocument: true } : rest));
  if (offlineData === undefined || apart) {
    return serializedRest;
  }

  const separator = serializedRest === '{}' ? '' : ',';

  return `{"offlineData":${spaceDocument(offlineData).json}${separator}${serializedRest.slice(1)}`;
};
