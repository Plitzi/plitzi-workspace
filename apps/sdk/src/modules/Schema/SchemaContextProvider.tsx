import { get, pick } from '@plitzi/plitzi-ui/helpers';
import { useMemo, use } from 'react';

import NetworkInternalContext from '@modules/Network/contexts/NetworkInternalContext';
import { EMPTY_SCHEMA } from '@plitzi/sdk-shared/schema/schemaConstants';
import { createStoreHook } from '@plitzi/sdk-shared/store';

import type { SdkState, Element, Schema } from '@plitzi/sdk-shared';
import type { ReactNode } from 'react';

export type SchemaContextProviderProps = {
  children: ReactNode;
  schema?: Schema;
};

const SchemaContextProvider = ({ children, schema: schemaProp }: SchemaContextProviderProps) => {
  const internalData = use(NetworkInternalContext);
  const schema = useMemo(
    () => ({ ...EMPTY_SCHEMA.schema, ...(schemaProp ? schemaProp : internalData.schema) }),
    [schemaProp, internalData.schema]
  );
  const { useStoreSync } = createStoreHook<SdkState>();
  useStoreSync('schema', schema);

  const pageDefinitions = useMemo(
    () => pick(get(schema, 'flat', {}), get(schema, 'pages', [])) as Record<string, Element>,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [schema.pages]
  );

  useStoreSync('pageDefinitions', pageDefinitions);

  return children;
};

export default SchemaContextProvider;
