import { buildSpace } from './helpers';

import type { Space } from '../helpers';

// The trigger a hand-written flow starts with: a flow without one never runs, and the linter refuses it.
export const clickTrigger = (next: string) => ({
  'onClick-1': {
    id: 'onClick-1',
    title: 'Click',
    type: 'trigger' as const,
    action: 'onClick',
    params: {},
    preview: {},
    elementId: 'c1',
    beforeNode: '',
    afterNode: next,
    flowId: 'onClick-1',
    enabled: true
  }
});

// Interactions are wired by the element's id, which is also how the flow is addressed here.
// A button beside the container: what an element setState writes has to be something the element reads, and a
// button reads `content` and `disabled`.
export const interactiveSpace = (): Space => {
  const space = buildSpace();
  space.schema.flat.b1 = {
    id: 'b1',
    attributes: { subType: 'button', content: 'Save' },
    definition: {
      rootId: 'home',
      parentId: 'home',
      label: 'Button',
      type: 'button',
      items: [],
      styleSelectors: { base: '' }
    }
  };
  space.schema.flat.home.definition.items = [...(space.schema.flat.home.definition.items ?? []), 'b1'];

  return space;
};
