import type { ElementContextValue } from '../Element/ElementContext';

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

// Shorthand for skip-HOC context entries (manual-render path)
const skipHocEntry = (id = ''): ElementContextValue => elementEntry(id, { plitziJsxSkipHOC: true });

export { elementEntry, skipHocEntry };
