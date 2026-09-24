import { escapeJson } from './escapeJson';

import type { OfflineDataRaw } from '@plitzi/sdk-shared';

const serializedSpaces = new WeakMap<OfflineDataRaw, string>();

/**
 * The space as the page embeds it, serialized once per space object rather than once per render.
 *
 * It is most of the payload — tens of kilobytes of schema and style — and the adapters hand every request the same
 * object until the space changes, so turning it into escaped JSON on each render was a tenth of a render's CPU spent
 * producing the same string. Keyed weakly: a space the adapters let go of takes its string with it.
 */
const serializeSpace = (offlineData: OfflineDataRaw): string => {
  const known = serializedSpaces.get(offlineData);
  if (known !== undefined) {
    return known;
  }

  const serialized = escapeJson(JSON.stringify(offlineData));
  serializedSpaces.set(offlineData, serialized);

  return serialized;
};

/**
 * What the page's bootstrap reads: `{ offlineData, ...rest }` as escaped JSON, byte for byte what serializing the
 * whole object would give. The escaping replaces characters one by one, so escaping the parts and joining them is
 * the same as escaping the whole.
 */
export const hydrationPayload = (offlineData: OfflineDataRaw | undefined, rest: Record<string, unknown>): string => {
  const serializedRest = escapeJson(JSON.stringify(rest));
  if (offlineData === undefined) {
    return serializedRest;
  }

  const separator = serializedRest === '{}' ? '' : ',';

  return `{"offlineData":${serializeSpace(offlineData)}${separator}${serializedRest.slice(1)}`;
};
