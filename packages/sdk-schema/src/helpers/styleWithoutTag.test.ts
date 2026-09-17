import { describe, expect, it } from 'vitest';

import { styleWithoutTag } from './styleWithoutTag';

import type { Element, Style } from '@plitzi/sdk-shared';

const provider = (attributes: Record<string, unknown>, base: string): Element => ({
  id: 'api-1',
  attributes,
  definition: { rootId: 'page-1', label: 'Api', type: 'apiContainer', items: [], styleSelectors: { base } }
});

const style: Pick<Style, 'platform'> = {
  platform: {
    desktop: {
      stack: { name: 'stack', type: 'class', cache: '', attributes: { base: { default: { 'row-gap': '32px' } } } },
      empty: { name: 'empty', type: 'class', cache: '', attributes: { base: { default: {} } } }
    },
    tablet: {},
    mobile: {}
  }
};

describe('styleWithoutTag', () => {
  it('names a provider with no tag whose class has rules', () => {
    expect(styleWithoutTag(provider({ subType: '' }, 'stack'), style)).toContain('no `subType`');
    expect(styleWithoutTag(provider({}, 'stack'), style)).toBeDefined();
  });

  it('says nothing about a tagged provider, or a class with no rules', () => {
    expect(styleWithoutTag(provider({ subType: 'div' }, 'stack'), style)).toBeUndefined();
    expect(styleWithoutTag(provider({}, 'empty'), style)).toBeUndefined();
    expect(styleWithoutTag(provider({}, ''), style)).toBeUndefined();
  });
});
