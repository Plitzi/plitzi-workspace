import { createContext } from 'react';

import type { CollectionContextValue } from '@plitzi/sdk-shared';

const collectionContextDefaultValue = {} as CollectionContextValue;

const CollectionContext = createContext<CollectionContextValue>(collectionContextDefaultValue);

export default CollectionContext;
