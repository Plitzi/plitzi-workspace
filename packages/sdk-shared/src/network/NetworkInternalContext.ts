import { sharedContext } from '../helpers/sharedContext';

import type { OfflineData } from '../types';

export type NetworkInternalContextValue = OfflineData;

const NetworkInternalContext = sharedContext('NetworkInternalContext', {} as NetworkInternalContextValue);

export default NetworkInternalContext;
