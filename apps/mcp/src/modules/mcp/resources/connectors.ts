import { connectorPresets, connectorTokens } from '@plitzi/sdk-shared/connectors';

import { afterPrefix, connectorPresetsUri, connectorUri, connectorsUri, findConnectorEntry } from '../helpers';
import { envelope } from './envelope';

import type { Space } from '../helpers';
import type { Env, ResourceEnvelope } from '../types';
import type { ConnectorEntry } from '@plitzi/sdk-shared';

/** What a provider element needs to know about a connector without opening it: which endpoints it can address,
 *  which operators its filters may use, and which fields it publishes. The listing carries this for every
 *  connector so choosing one — and wiring an apiContainer to it — takes a single read. */
const summarize = (entry: ConnectorEntry) => {
  const { manifest } = entry;

  return {
    ref: entry.id,
    name: entry.name,
    baseUrl: manifest.baseUrl,
    read: Object.keys(manifest.endpoints.read),
    write: Object.keys(manifest.endpoints.write ?? {}),
    operators: Object.keys(manifest.operators ?? {}),
    pagination: manifest.pagination,
    credential: manifest.credential,
    fields: manifest.fields
  };
};

export const connectorSummaries = (space: Space) => ({ connectors: space.connectors.map(summarize) });

/** Connector reads: the space's connector listing and one full manifest. Undefined when the URI belongs to
 *  another family, null when the shape is ours but the ref does not resolve.
 *
 *  The item read returns the manifest verbatim, endpoints and auth template included. That is server-side state
 *  the browser never sees, but an agent authoring one has to read back what it wrote — and the manifest holds no
 *  secret either way: `credential` names a secret, it does not carry it. */
export const readConnectorResource = (
  space: Space,
  env: Env,
  uri: string
): ResourceEnvelope<unknown> | null | undefined => {
  // Space-independent: the working manifests for the providers people actually run, plus the template vocabulary
  // the engine binds. These are the same presets the builder panel offers, so an agent and a human start a Strapi
  // integration from one document rather than from two that drift.
  if (uri === connectorPresetsUri) {
    // `blank` is the builder form's empty slate — it has no base URL and does not validate. An agent needs worked
    // examples, so it is not offered here.
    return envelope({
      presets: connectorPresets.filter(preset => preset.id !== 'blank'),
      tokens: connectorTokens
    });
  }

  if (uri === connectorsUri(env)) {
    return envelope(connectorSummaries(space));
  }

  const ref = afterPrefix(uri, connectorUri(env, ''));
  if (ref === undefined) {
    return undefined;
  }

  const entry = findConnectorEntry(space, ref);

  return entry ? envelope({ ref: entry.id, name: entry.name, manifest: entry.manifest }) : null;
};
