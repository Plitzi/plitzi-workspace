import { styleCacheTravelsInDocument } from '@plitzi/sdk-shared/style';

import { escapeJson } from './escapeJson';

import type { OfflineDataRaw } from '@plitzi/sdk-shared';

type SerializedSpace = { whole?: string; withoutStyleCache?: string };

const serializedSpaces = new WeakMap<OfflineDataRaw, SerializedSpace>();

/**
 * The space as the page embeds it, serialized once per space object rather than once per render.
 *
 * It is most of the payload — tens of kilobytes of schema and style — and the adapters hand every request the same
 * object until the space changes, so turning it into escaped JSON on each render was a tenth of a render's CPU spent
 * producing the same string. Keyed weakly: a space the adapters let go of takes its string with it.
 */
const serializeSpace = (offlineData: OfflineDataRaw, withoutStyleCache: boolean): string => {
  let serialized = serializedSpaces.get(offlineData);
  if (!serialized) {
    serialized = {};
    serializedSpaces.set(offlineData, serialized);
  }

  if (withoutStyleCache) {
    serialized.withoutStyleCache ??= escapeJson(
      JSON.stringify({ ...offlineData, style: { ...offlineData.style, cache: '' } })
    );

    return serialized.withoutStyleCache;
  }

  serialized.whole ??= escapeJson(JSON.stringify(offlineData));

  return serialized.whole;
};

/**
 * What the page's bootstrap reads: `{ offlineData, ...rest }` as escaped JSON, byte for byte what serializing the
 * whole object would give. The escaping replaces characters one by one, so escaping the parts and joining them is
 * the same as escaping the whole.
 *
 * The compiled stylesheet is left out when the page's own runtime stylesheet carries it in a form the browser reads
 * back exactly (`styleCacheTravelsInDocument`), and `styleCacheInDocument` tells the bootstrap to. It is the largest
 * part of the style document, and the page would otherwise ship it twice.
 */
export const hydrationPayload = (offlineData: OfflineDataRaw | undefined, rest: Record<string, unknown>): string => {
  const inDocument = offlineData !== undefined && styleCacheTravelsInDocument(offlineData.style.cache);
  const serializedRest = escapeJson(JSON.stringify(inDocument ? { ...rest, styleCacheInDocument: true } : rest));
  if (offlineData === undefined) {
    return serializedRest;
  }

  const separator = serializedRest === '{}' ? '' : ',';

  return `{"offlineData":${serializeSpace(offlineData, inDocument)}${separator}${serializedRest.slice(1)}`;
};
