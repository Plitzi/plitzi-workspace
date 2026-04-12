import { createContext } from 'react';

const SpaceContext = createContext<Record<string, unknown>>({});
SpaceContext.displayName = 'SpaceContext';

export default SpaceContext;
