// Packages
import { createContext } from 'react';

// Types
import type { Style, Schema } from '@plitzi/sdk-shared';

export type SchemaContextValue = {
  schema: Schema;
  style: Style;
  definition: { rootId: string }; // for segments and templates
};

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
