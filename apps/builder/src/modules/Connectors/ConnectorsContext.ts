import { createContext } from 'react';

import type { ConnectorManifestDraft, SpaceConnector } from '@plitzi/sdk-shared';

export type ConnectorsContextValue = {
  connectors: Record<string, SpaceConnector>;
  isLoading: boolean;
  error: string;
  /** True when the space has at least one deployment that can run server code, which is what resolves connectors. */
  hasServerRendering: boolean;
  addConnector: (name: string, manifest: ConnectorManifestDraft) => Promise<SpaceConnector | undefined>;
  updateConnector: (
    identifier: string,
    name: string,
    manifest: ConnectorManifestDraft
  ) => Promise<SpaceConnector | undefined>;
  removeConnector: (identifier: string) => Promise<boolean>;
};

const ConnectorsContext = createContext<ConnectorsContextValue>({
  connectors: {},
  isLoading: false,
  error: '',
  hasServerRendering: false,
  addConnector: () => Promise.resolve(undefined),
  updateConnector: () => Promise.resolve(undefined),
  removeConnector: () => Promise.resolve(false)
});
ConnectorsContext.displayName = 'ConnectorsContext';

export default ConnectorsContext;
