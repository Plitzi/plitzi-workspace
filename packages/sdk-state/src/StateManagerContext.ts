import { createContext } from 'react';

export type StateManagerContextValue = { state?: Record<string, unknown> };

const stateManagerContextDefaultValue: StateManagerContextValue = {};

const StateManagerContext = createContext<StateManagerContextValue>(stateManagerContextDefaultValue);

export default StateManagerContext;
