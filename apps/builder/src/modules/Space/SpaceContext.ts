import { createContext } from 'react';

export type SpaceContextValue = object;

const spaceContextDefaultValue = {} as SpaceContextValue;

const SpaceContext = createContext(spaceContextDefaultValue);
SpaceContext.displayName = 'SpaceContext';

export default SpaceContext;
