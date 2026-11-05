import { sharedContext } from '../../react/sharedContext';

import type { SchemaContextValue } from '../../types';

const schemaContextDefaultValue: SchemaContextValue = { definition: { rootId: '' } };

const SchemaContext = sharedContext<SchemaContextValue>('SchemaContext', schemaContextDefaultValue);

export default SchemaContext;
