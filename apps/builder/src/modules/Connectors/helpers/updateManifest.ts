import type {
  ConnectorAuth,
  ConnectorManifestDraft,
  ConnectorReadEndpoint,
  ConnectorWriteEndpoint
} from '@plitzi/sdk-shared';

export type EndpointKind = 'read' | 'write';

const omitKey = <T extends object>(source: T, key: keyof T): Partial<T> =>
  Object.fromEntries(Object.entries(source).filter(([current]) => current !== key)) as Partial<T>;

/** Same idea for an open map, where dropping a key leaves the value type intact rather than making it optional. */
const omitEntry = <T>(source: Record<string, T>, key: string): Record<string, T> =>
  Object.fromEntries(Object.entries(source).filter(([current]) => current !== key));

/**
 * Immutable setters for the parts of a manifest the basic editor exposes.
 *
 * They live outside the components because the nesting is the awkward part — `endpoints.read.list.query` is four
 * levels down — and every field would otherwise repeat the same spread chain, which is exactly where a typo
 * silently drops a sibling key.
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

export const setReadEndpoint = (
  manifest: ConnectorManifestDraft,
  name: string,
  endpoint: ConnectorReadEndpoint
): ConnectorManifestDraft => ({
  ...manifest,
  endpoints: { ...manifest.endpoints, read: { ...manifest.endpoints.read, [name]: endpoint } }
});

export const setWriteEndpoint = (
  manifest: ConnectorManifestDraft,
  name: string,
  endpoint: ConnectorWriteEndpoint
): ConnectorManifestDraft => ({
  ...manifest,
  endpoints: { ...manifest.endpoints, write: { ...manifest.endpoints.write, [name]: endpoint } }
});

export const removeEndpoint = (
  manifest: ConnectorManifestDraft,
  kind: EndpointKind,
  name: string
): ConnectorManifestDraft => {
  if (kind === 'read') {
    return { ...manifest, endpoints: { ...manifest.endpoints, read: omitEntry(manifest.endpoints.read, name) } };
  }

  const write = omitEntry(manifest.endpoints.write ?? {}, name);
  const endpoints = omitKey(manifest.endpoints, 'write') as ConnectorManifestDraft['endpoints'];

  // An empty `write` is dropped rather than stored: the engine refuses any action a manifest does not declare, so
  // both say the same thing, and the absent one cannot be misread as an oversight.
  return { ...manifest, endpoints: Object.keys(write).length ? { ...endpoints, write } : endpoints };
};

/**
 * Renames an endpoint in place.
 *
 * The key is the name elements address the endpoint by, so the entry is rebuilt in order rather than deleted and
 * appended — a list that reshuffles itself while being typed in is its own kind of broken.
 */
export const renameEndpoint = (
  manifest: ConnectorManifestDraft,
  kind: EndpointKind,
  from: string,
  to: string
): ConnectorManifestDraft => {
  const source: Record<string, unknown> = kind === 'read' ? manifest.endpoints.read : (manifest.endpoints.write ?? {});
  if (!to || from === to || to in source) {
    return manifest;
  }

  const renamed = Object.fromEntries(Object.entries(source).map(([key, value]) => [key === from ? to : key, value]));

  return {
    ...manifest,
    endpoints:
      kind === 'read'
        ? { ...manifest.endpoints, read: renamed as ConnectorManifestDraft['endpoints']['read'] }
        : { ...manifest.endpoints, write: renamed as ConnectorManifestDraft['endpoints']['write'] }
  };
};

export const setMediaBaseUrl = (manifest: ConnectorManifestDraft, baseUrl: string): ConnectorManifestDraft => {
  if (!baseUrl) {
    return omitKey(manifest, 'media') as ConnectorManifestDraft;
  }

  return { ...manifest, media: { baseUrl } };
};
