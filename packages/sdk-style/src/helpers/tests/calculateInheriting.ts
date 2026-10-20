import type { Element, Style } from '@plitzi/sdk-shared';

export const baseElement: Element = {
  id: '1',
  attributes: {},
  definition: {
    label: 'Button',
    type: 'button',
    rootId: '1',
    parentId: undefined,
    styleSelectors: { base: 'btn' }
  }
};

export const emptyPlatform: Style['platform'] = { desktop: {}, tablet: {}, mobile: {} };
