import { ElementContext } from '../Element/ElementContext';

import type { ElementContextEntry, ElementContextValue } from '../Element/ElementContext';
import type { ReactNode } from 'react';

// Test helper: builds a resolved element entry with sensible defaults so a component rendered with a mocked
// `withElement` (identity) still finds its data through `useElement()` / `RootElement`.
const elementEntry = (id: string, overrides: Partial<ElementContextValue> = {}): ElementContextValue => ({
  id,
  rootId: 'root',
  attributes: {},
  definition: { rootId: 'root', label: id, type: '', styleSelectors: { base: '' } },
  elementState: {},
  setElementState: () => true,
  ...overrides
});

// Provides a single element's resolved data through `ElementContext`, for tests that render a component with a mocked
// `withElement` (identity). Tests that exercise the real `withElement` render without this — it provides its own.
const ElementContextSeed = ({ value, children }: { value: ElementContextEntry; children: ReactNode }) => (
  <ElementContext value={value as ElementContextValue}>{children}</ElementContext>
);

export { elementEntry, ElementContextSeed };
