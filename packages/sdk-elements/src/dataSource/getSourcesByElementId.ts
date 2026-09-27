import { renderContext } from '@plitzi/sdk-schema/helpers/elementTree';

import type { Schema, Source } from '@plitzi/sdk-shared';

// Enumerates the data sources visible to an element: globals (`meta.id === 'global'`) plus scoped sources owned by
// the elements it renders inside (`renderContext`: its ancestors, and the layout shells around its page). Reads the
// registry from the store `sources` slice.
// Unregistering a source `unmount`s its key, so the registry never holds dead `undefined` entries to defend against.
const getSourcesByElementId = (
  sources: Record<string, Source> = {},
  schemaFlat?: Schema['flat'],
  id?: string
): Record<string, Source> => {
  if (!id || !schemaFlat) {
    return {};
  }

  const ids = renderContext(schemaFlat, id);

  return Object.values(sources)
    .filter(source => source.meta.id === 'global' || (!!source.meta.id && ids.includes(source.meta.id)))
    .reduce<Record<string, Source>>((acum, source) => ({ ...acum, [source.id]: source }), {});
};

export default getSourcesByElementId;
