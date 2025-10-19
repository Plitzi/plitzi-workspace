import { createContext } from 'react';

import type { CollectionContextValue } from '../types';

const collectionContextDefaultValue = {} as CollectionContextValue;

const CollectionContext = createContext<CollectionContextValue>(collectionContextDefaultValue);

export default CollectionContext;
