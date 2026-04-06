import { createContext } from 'react';

import type { SchemaContextValue } from '@plitzi/sdk-shared';

const schemaContextDefaultValue: SchemaContextValue = { definition: { rootId: '' } };

const SchemaContext = createContext<SchemaContextValue>(schemaContextDefaultValue);

export default SchemaContext;
