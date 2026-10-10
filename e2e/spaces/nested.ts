import { MINIMAL_IDS, minimalSpace } from './minimal';

import type { Element, OfflineDataRaw } from '@plitzi/sdk-shared';

/** A space drawn inside another one, handed the inner space's documents: by the `plitziSdk` element, or by a plugin
 *  rendering the exported `<PlitziSdk>` in its own tree (`nestedSdk`, the harness's).
 *
 *  The outer space is `minimalSpace()`, so every name a spec addresses is the inner space's. */

export const NESTED_IDS = { element: 'nested-sdk' };

/** What draws the inner space: the element, or a plugin. */
export type NestedThrough = 'plitziSdk' | 'nestedSdk';

export const nestedSpace = (inner: OfflineDataRaw, through: NestedThrough = 'plitziSdk'): OfflineDataRaw => {
  const outer = minimalSpace({ heading: 'Outer space' });
  const page = outer.schema.flat[MINIMAL_IDS.page];
  const element: Element = {
    id: NESTED_IDS.element,
    attributes: { offlineData: { schema: inner.schema, style: inner.style } },
    definition: {
      label: 'Plitzi Sdk',
      type: through,
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
