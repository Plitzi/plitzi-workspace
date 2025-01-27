// Packages
import { createContext } from 'react';

// Types
import type { Style, Schema } from '@plitzi/sdk-shared';

// @todo: replace all unknown types

export type SchemaContextValue = {
  schema: Schema;
  style: Style;
  definition: { rootId: string };
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
  definition: { rootId: '' } // for segments and templates
};

const SchemaContext = createContext<SchemaContextValue | undefined>(schemaContextDefaultValue);

export default SchemaContext;
