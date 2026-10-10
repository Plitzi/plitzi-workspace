import { MINIMAL_IDS, minimalSpace } from './minimal';

import type { Element, OfflineDataRaw } from '@plitzi/sdk-shared';

/** A space drawn inside another one: the `plitziSdk` element, handed the inner space's documents.
 *
 *  Written into the documents by hand — `plitziSdk` runs a whole space, so it is declared where the SDK is and not in
 *  the authoring catalogue. The outer space is `minimalSpace()`, so every name a spec addresses is the inner space's. */

export const NESTED_IDS = { element: 'nested-sdk' };

export const nestedSpace = (inner: OfflineDataRaw): OfflineDataRaw => {
  const outer = minimalSpace({ heading: 'Outer space' });
  const page = outer.schema.flat[MINIMAL_IDS.page];
  const element: Element = {
    id: NESTED_IDS.element,
    attributes: { offlineData: { schema: inner.schema, style: inner.style } },
    definition: {
      label: 'Plitzi Sdk',
      type: 'plitziSdk',
      rootId: page.id,
      parentId: page.id,
      items: [],
      styleSelectors: { base: '' },
      initialState: { visibility: true }
    }
  };

  return {
    schema: {
      ...outer.schema,
      flat: {
        ...outer.schema.flat,
        [page.id]: {
          ...page,
          definition: { ...page.definition, items: [...(page.definition.items ?? []), element.id] }
        },
        [element.id]: element
      }
    },
    style: outer.style
  };
};
