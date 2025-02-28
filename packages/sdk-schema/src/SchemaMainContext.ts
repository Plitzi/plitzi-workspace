import { createContext } from 'react';

import type { Schema } from '@plitzi/sdk-shared';

export type SchemaMainContextValue = {
  pages: Schema['pages'];
  pageDefinition: Element[];
  pageFolders: Schema['pageFolders'];
  settings: Schema['settings'];
  variables: Schema['variables'];
};

const schemaMainContextDefaultValue: SchemaMainContextValue = {
  pages: [],
  pageDefinition: [],
  variables: [],
  settings: { customCss: '' },
  pageFolders: []
};

const SchemaMainContext = createContext<SchemaMainContextValue | undefined>(schemaMainContextDefaultValue);

export default SchemaMainContext;
