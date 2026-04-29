import { createContext } from 'react';

import type { OfflineData } from '../types';

export type NetworkInternalContextValue = Omit<OfflineData, 'collections' | 'segments'> & {
  segments: NonNullable<OfflineData['segments']>;
  collections: NonNullable<OfflineData['collections']>;
};

const NetworkInternalContext = createContext({} as NetworkInternalContextValue);
NetworkInternalContext.displayName = 'NetworkInternalContext';

export default NetworkInternalContext;
