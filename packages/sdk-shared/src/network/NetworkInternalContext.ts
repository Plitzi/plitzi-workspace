import { createContext } from 'react';

import type { OfflineData } from '../types';

export type NetworkInternalContextValue = Omit<OfflineData, 'segments'> & {
  segments: NonNullable<OfflineData['segments']>;
};

const NetworkInternalContext = createContext({} as NetworkInternalContextValue);
NetworkInternalContext.displayName = 'NetworkInternalContext';

export default NetworkInternalContext;
