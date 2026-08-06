import type { ConnectorEndpoints, ConnectorListEndpoint, ConnectorWrite } from '../types';

/** The pre-`endpoints` layout, where a connector's one list call sat beside the connection-wide settings. */
type LegacyManifest = {
  endpoints?: ConnectorEndpoints;
  list?: ConnectorListEndpoint;
  write?: ConnectorWrite;
};

/**
 * Lifts a pre-`endpoints` manifest into the current shape.
 *
 * `list` and `write` used to sit beside `auth` and `operators` at the root, which read as though a connector had one
 * hard-coded call rather than a set of them. Manifests authored before the move are stored documents, so they are
 * upgraded on read instead of being rejected; the builder saves the normalized form back, so this stops firing on
 * its own and can be deleted once no stored manifest carries a root-level `list`.
 */
export const normalizeManifest = <T extends object>(
  manifest: T
): Omit<T, 'list' | 'write'> & { endpoints: ConnectorEndpoints } => {
  // The legacy keys are what this function exists to look for, and a current manifest does not declare them — so the
  // shape being probed for cannot be the parameter's own constraint without rejecting every caller.
  const { list, write, ...rest } = manifest as T & LegacyManifest;
  if (rest.endpoints) {
    return rest as Omit<T, 'list' | 'write'> & { endpoints: ConnectorEndpoints };
  }

  return {
    ...rest,
    endpoints: { list: list ?? { path: '' }, ...(write ? { write } : {}) }
  };
};

export default normalizeManifest;
