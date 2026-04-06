import { createContext } from 'react';

import type { OfflineData } from '@plitzi/sdk-shared';

export type NetworkInternalContextValue = Omit<OfflineData, 'collections' | 'segments'> & {
  segments: NonNullable<OfflineData['segments']>;
  collections: NonNullable<OfflineData['collections']>;
};

const NetworkInternalContext = createContext({} as NetworkInternalContextValue);

export default NetworkInternalContext;
