import { createContext } from 'react';

import type { OfflineData } from '../../../types';

const NetworkInternalContext = createContext<OfflineData>({} as OfflineData);

export default NetworkInternalContext;
