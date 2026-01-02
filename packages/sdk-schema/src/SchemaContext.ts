import { createContext } from 'react';

import { EMPTY_STYLE_SCHEMA } from '@plitzi/sdk-style/StyleMap';

import { EMPTY_SCHEMA } from './helpers/FlatMap';

import type { SchemaContextValue } from '@plitzi/sdk-shared';

const schemaContextDefaultValue: SchemaContextValue = {
  schema: EMPTY_SCHEMA.schema,
  style: EMPTY_STYLE_SCHEMA,
  definition: { rootId: '' }
};

const SchemaContext = createContext<SchemaContextValue>(schemaContextDefaultValue);

export default SchemaContext;
