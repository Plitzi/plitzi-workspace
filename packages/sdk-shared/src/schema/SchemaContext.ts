import { createContext } from 'react';

import type { SchemaContextValue } from '@plitzi/sdk-shared';

const schemaContextDefaultValue: SchemaContextValue = { definition: { rootId: '' } };

const SchemaContext = createContext<SchemaContextValue>(schemaContextDefaultValue);
SchemaContext.displayName = 'SchemaContext';

export default SchemaContext;
