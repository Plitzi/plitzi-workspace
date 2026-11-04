import { pick } from '@plitzi/plitzi-ui/helpers';
import { useMemo, use } from 'react';

import { useStableValue } from '@plitzi/sdk-shared/hooks';
import { NetworkInternalContext } from '@plitzi/sdk-shared/network';
import { EMPTY_SCHEMA } from '@plitzi/sdk-shared/schema';
import { useSdkStoreSync } from '@plitzi/sdk-shared/store';

import type { Element, Schema } from '@plitzi/sdk-shared';
import type { ReactNode } from 'react';

export type SchemaContextProviderProps = {
  children: ReactNode;
  schema?: Schema;
};

/**
 * The pages' elements, one object per `flat` and list of pages: the page server draws the same schema objects on every
 * request until the space changes, and the routes built from these are kept by this object too (`NavigationProvider`).
 */
const pageDefinitionsByFlat = new WeakMap<
  Schema['flat'],
  { pages: Schema['pages']; definitions: Record<string, Element> }
>();

const pageDefinitionsOf = (flat: Schema['flat'], pages: Schema['pages']): Record<string, Element> => {
  const known = pageDefinitionsByFlat.get(flat);
  if (known && known.pages === pages) {
    return known.definitions;
  }

  // `pick` is typed over the whole of `flat`'s values; the pages are elements.
  const definitions = pick(flat, pages) as Record<string, Element>;
  pageDefinitionsByFlat.set(flat, { pages, definitions });

  return definitions;
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
  const pageDefinitions = useStableValue(pageDefinitionsOf(flat, pages));

  useSdkStoreSync('pageDefinitions', pageDefinitions);

  return children;
};

export default SchemaContextProvider;
