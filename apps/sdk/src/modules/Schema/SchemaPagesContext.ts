import { createContext } from 'react';

import type { Element } from '@plitzi/sdk-shared';

export type SchemaPagesContextValue = {
  pages: string[];
  pageDefinitions: Record<string, Element>;
};

const SchemaPagesContext = createContext<SchemaPagesContextValue>({ pages: [], pageDefinitions: {} });

export default SchemaPagesContext;
