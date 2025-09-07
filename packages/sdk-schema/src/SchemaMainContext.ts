import { createContext } from 'react';

import type { Element, Schema } from '@plitzi/sdk-shared';

export type SchemaMainContextValue = {
  pages: Schema['pages'];
  pageDefinitions: Record<string, Element>;
  pageFolders: Schema['pageFolders'];
  settings: Schema['settings'];
  variables: Schema['variables'];
};

const schemaMainContextDefaultValue: SchemaMainContextValue = {
  pages: [],
  pageDefinitions: {},
  variables: [],
  settings: { customCss: '' },
  pageFolders: []
};

const SchemaMainContext = createContext<SchemaMainContextValue>(schemaMainContextDefaultValue);

export default SchemaMainContext;
