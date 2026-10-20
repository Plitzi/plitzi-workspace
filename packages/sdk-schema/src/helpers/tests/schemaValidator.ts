import type { Element } from '@plitzi/sdk-shared';

// Helper to create element
export const createElement = (id: string, type: string, rootId?: string): Element => ({
  id,
  attributes: {},
  definition: {
    rootId: rootId || (type === 'page' ? id : 'page-1'),
    label: id,
    type,
    styleSelectors: { base: id }
  }
});
