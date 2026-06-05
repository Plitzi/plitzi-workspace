import { getStoreHistory } from '../history/createStoreHistory';

import type { StoreHistoryOptions } from '../history/createStoreHistory';
import type { StoreMiddleware } from '../types';

// Starts recording the action log / time-travel history at store creation. The handle is retrieved later with
// `getStoreHistory(store)` (e.g. by a devtools panel or `useStoreHistory`). History self-subscribes to the same
// `subscribeChange` substrate logger and persist use.
export const history = <TState extends object>(options?: StoreHistoryOptions): StoreMiddleware<TState> => {
  return api => {
    getStoreHistory(api, options);
  };
};
