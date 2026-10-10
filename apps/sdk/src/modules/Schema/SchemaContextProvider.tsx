import { pick } from '@plitzi/plitzi-ui/helpers';
import { useMemo, use } from 'react';

import useStableValue from '@plitzi/sdk-shared/hooks/useStableValue';
import NetworkInternalContext from '@plitzi/sdk-shared/network/NetworkInternalContext';
import { EMPTY_SCHEMA } from '@plitzi/sdk-shared/schema/schemaConstants';
import { useSdkStoreSync } from '@plitzi/sdk-shared/store';

import type { Element, Schema } from '@plitzi/sdk-shared';
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
  useSdkStoreSync('schema', schema);

  /**
   * The pages' own elements, which the routes are built from — their slug, who may see them, their flag. Read from
   * `flat`, not only when the list of pages changes: an edit to one page leaves `pages` the same array, and the routes
   * kept its old address. Kept the same object while every page is the same, so an edit elsewhere in the space does
   * not rebuild them.
   */
  const { flat, pages } = schema;
  const pageDefinitions = useStableValue(useMemo(() => pick(flat, pages) as Record<string, Element>, [flat, pages]));

  useSdkStoreSync('pageDefinitions', pageDefinitions);

  return children;
};

export default SchemaContextProvider;
