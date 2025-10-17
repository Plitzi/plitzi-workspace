import { createContext } from 'react';

import type { OfflineDataParsed } from '../../../types';

const NetworkInternalContext = createContext<OfflineDataParsed>({} as OfflineDataParsed);

export default NetworkInternalContext;
