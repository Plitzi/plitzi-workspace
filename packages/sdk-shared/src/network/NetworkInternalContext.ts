import { sharedContext } from '../helpers/sharedContext';

import type { OfflineData } from '../types';

export type NetworkInternalContextValue = Omit<OfflineData, 'segments'> & {
  segments: NonNullable<OfflineData['segments']>;
};

const NetworkInternalContext = sharedContext('NetworkInternalContext', {} as NetworkInternalContextValue);

export default NetworkInternalContext;
