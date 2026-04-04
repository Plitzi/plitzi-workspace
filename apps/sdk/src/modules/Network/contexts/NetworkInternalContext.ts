import { createContext } from 'react';

import type { OfflineData } from '@plitzi/sdk-shared';

const NetworkInternalContext = createContext({} as OfflineData);

export default NetworkInternalContext;
