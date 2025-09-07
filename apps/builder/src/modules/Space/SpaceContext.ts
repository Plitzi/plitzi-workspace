import { createContext } from 'react';

export type SpaceContextValue = object;

const spaceContextDefaultValue = {};

const SpaceContext = createContext<SpaceContextValue>(spaceContextDefaultValue);

export default SpaceContext;
