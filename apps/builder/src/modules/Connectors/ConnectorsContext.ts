import { createContext } from 'react';

import type { SpaceConnector } from '@plitzi/sdk-shared';

export type ConnectorsContextValue = {
  connectors: Record<string, SpaceConnector>;
  isLoading: boolean;
  error: string;
  addConnector: (name: string, manifest: Record<string, unknown>) => Promise<SpaceConnector | undefined>;
  updateConnector: (
    identifier: string,
    name: string,
    manifest: Record<string, unknown>
  ) => Promise<SpaceConnector | undefined>;
  removeConnector: (identifier: string) => Promise<boolean>;
};

const ConnectorsContext = createContext<ConnectorsContextValue>({
  connectors: {},
  isLoading: false,
  error: '',
  addConnector: () => Promise.resolve(undefined),
  updateConnector: () => Promise.resolve(undefined),
  removeConnector: () => Promise.resolve(false)
});
ConnectorsContext.displayName = 'ConnectorsContext';

export default ConnectorsContext;
