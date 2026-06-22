import { useState } from 'react';

import { createEntityStore } from '@plitzi/nexus/entities';
import { ElementStoreContext } from '@plitzi/sdk-shared/elements/ElementStore';

import type { ElementStoreEntry } from '@plitzi/sdk-shared/elements/ElementStore';
import type { ReactNode } from 'react';

// Test helper: builds a resolved element entry with sensible defaults so a component rendered with a mocked
// `withElement` (identity) still finds its data through `useElement(id)` / `RootElement`.
const elementEntry = (id: string, overrides: Partial<ElementStoreEntry> = {}): ElementStoreEntry => ({
  id,
  rootId: 'root',
  attributes: {},
  definition: { rootId: 'root', label: id, type: '', styleSelectors: { base: '' } },
  elementState: {},
  setElementState: () => true,
  ...overrides
});

// Seeds an isolated element store with the given entries and provides it, replacing the old `<ElementContext value>`
// test wrapper. Use an empty `entries` array for tests that exercise the real `withElement` (it publishes itself).
const ElementStoreSeed = ({ entries = [], children }: { entries?: ElementStoreEntry[]; children: ReactNode }) => {
  const [store] = useState(() => createEntityStore<ElementStoreEntry>(entries));

  return <ElementStoreContext value={store}>{children}</ElementStoreContext>;
};

export { elementEntry, ElementStoreSeed };
