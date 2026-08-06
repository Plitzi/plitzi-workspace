import type {
  ConnectorAuth,
  ConnectorListEndpoint,
  ConnectorManifestDraft,
  ConnectorWriteAction,
  ConnectorWriteOperation
} from '@plitzi/sdk-shared';

const omitKey = <T extends object>(source: T, key: keyof T): Partial<T> =>
  Object.fromEntries(Object.entries(source).filter(([current]) => current !== key)) as Partial<T>;

/**
 * Immutable setters for the parts of a manifest the basic editor exposes.
 *
 * They live outside the components because the nesting is the awkward part — `endpoints.list.query` is three levels
 * down — and every field would otherwise repeat the same spread chain, which is exactly where a typo silently drops
 * a sibling key.
 */
export const setConnection = <K extends keyof ConnectorManifestDraft>(
  manifest: ConnectorManifestDraft,
  key: K,
  value: ConnectorManifestDraft[K]
): ConnectorManifestDraft => ({ ...manifest, [key]: value });

/** An empty name and value mean the scheme is incomplete, so the whole `auth` block goes rather than half of it. */
export const setAuth = <K extends keyof ConnectorAuth>(
  manifest: ConnectorManifestDraft,
  key: K,
  value: ConnectorAuth[K]
): ConnectorManifestDraft => {
  const auth: ConnectorAuth = { in: 'header', name: '', value: '', ...manifest.auth, [key]: value };
  if (!auth.name && !auth.value) {
    return omitKey(manifest, 'auth') as ConnectorManifestDraft;
  }

  return { ...manifest, auth };
};

export const setList = <K extends keyof ConnectorListEndpoint>(
  manifest: ConnectorManifestDraft,
  key: K,
  value: ConnectorListEndpoint[K]
): ConnectorManifestDraft => ({
  ...manifest,
  endpoints: { ...manifest.endpoints, list: { ...manifest.endpoints.list, [key]: value } }
});

export const setWrite = (
  manifest: ConnectorManifestDraft,
  action: ConnectorWriteAction,
  operation: ConnectorWriteOperation | undefined
): ConnectorManifestDraft => {
  const others = omitKey(manifest.endpoints.write ?? {}, action);
  const write = operation ? { ...others, [action]: operation } : others;
  // An empty `write` is dropped rather than stored: the engine refuses any action a manifest does not declare, so
  // both say the same thing, and the absent one cannot be misread as an oversight.
  const endpoints = omitKey(manifest.endpoints, 'write') as ConnectorManifestDraft['endpoints'];

  return { ...manifest, endpoints: Object.keys(write).length ? { ...endpoints, write } : endpoints };
};

export const setMediaBaseUrl = (manifest: ConnectorManifestDraft, baseUrl: string): ConnectorManifestDraft => {
  if (!baseUrl) {
    return omitKey(manifest, 'media') as ConnectorManifestDraft;
  }

  return { ...manifest, media: { baseUrl } };
};
