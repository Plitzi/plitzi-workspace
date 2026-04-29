/* eslint-disable @typescript-eslint/no-explicit-any */

import { createContext } from 'react';

import type { StoreApi } from './types';

const StoreContext = createContext<StoreApi<any> | undefined>(undefined);
StoreContext.displayName = 'StoreContext';

export { StoreContext };
