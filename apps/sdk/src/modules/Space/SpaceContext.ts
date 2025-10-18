import { createContext } from 'react';

const SpaceContext = createContext<Record<string, unknown>>({});

export default SpaceContext;
