import { createContext } from 'react';

import type { StateManagerContextValue } from '@plitzi/sdk-shared';

const stateManagerContextDefaultValue: StateManagerContextValue = {
  state: {}
} as StateManagerContextValue;

const StateManagerContext = createContext(stateManagerContextDefaultValue);
StateManagerContext.displayName = 'StateManagerContext';

export default StateManagerContext;
