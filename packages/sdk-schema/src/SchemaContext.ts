import { createContext } from 'react';

import type { SchemaContextValue } from '@plitzi/sdk-shared';

const schemaContextDefaultValue: SchemaContextValue = {
  schema: {
    flat: {},
    variables: [],
    settings: { customCss: '' },
    pages: [],
    pageFolders: []
  },
  style: { platform: { desktop: {}, tablet: {}, mobile: {} }, variables: {}, cache: '' },
  definition: { rootId: '' }
};

const SchemaContext = createContext<SchemaContextValue>(schemaContextDefaultValue);

export default SchemaContext;
