import { createContext } from 'react';

import { EMPTY_SCHEMA } from './schemaConstants';
import { EMPTY_STYLE_SCHEMA } from '../style/styleConstants';

import type { SchemaContextValue } from '@plitzi/sdk-shared';

const schemaContextDefaultValue: SchemaContextValue = {
  schema: EMPTY_SCHEMA.schema,
  style: EMPTY_STYLE_SCHEMA,
  definition: { rootId: '' }
};

const SchemaContext = createContext<SchemaContextValue>(schemaContextDefaultValue);

export default SchemaContext;
