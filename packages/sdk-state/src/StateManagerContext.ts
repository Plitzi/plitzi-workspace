import { createContext } from 'react';

import type { StateManagerContextValue } from '@plitzi/sdk-shared';

const stateManagerContextDefaultValue: StateManagerContextValue = {
  state: {}
} as StateManagerContextValue;

const StateManagerContext = createContext<StateManagerContextValue>(stateManagerContextDefaultValue);

export default StateManagerContext;
