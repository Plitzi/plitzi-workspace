import FlatMap from '@plitzi/sdk-schema/helpers/FlatMap';

import type { Schema, Source } from '@plitzi/sdk-shared';

// Enumerates the data sources visible to an element: globals (`meta.id === 'global'`) plus scoped sources
// owned by ancestor containers (via the schema parent tree). Reads the registry from the store `sources` slice.
const getSourcesByElementId = (
  sources: Record<string, Source> = {},
  schemaFlat?: Schema['flat'],
  id?: string
): Record<string, Source> => {
  if (!id || !schemaFlat) {
    return {};
  }

  const ids = FlatMap.parentTree(schemaFlat, id);

  return Object.values(sources)
    .filter(
      source =>
        ((source as Source | undefined) && source.meta.id && ids.includes(source.meta.id)) ||
        source.meta.id === 'global'
    )
    .reduce<Record<string, Source>>((acum, source) => ({ ...acum, [source.id]: source }), {});
};

export default getSourcesByElementId;
