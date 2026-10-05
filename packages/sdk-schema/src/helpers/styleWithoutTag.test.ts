import { describe, expect, it } from 'vitest';

import { rendersNoTag, styleWithoutTag } from './styleWithoutTag';

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

/** A channel with no tag is a provider like any other: no box of its own — what a page check must not call missing. */
describe('rendersNoTag', () => {
  it('is true of a provider or a channel with no tag, and of nothing else', () => {
    const channel = (subType?: string): Element => ({
      id: 'live',
      attributes: subType === undefined ? {} : { subType },
      definition: { rootId: 'page-1', label: 'Live', type: 'channel', items: [], styleSelectors: { base: '' } }
    });

    expect(rendersNoTag(provider({}, ''))).toBe(true);
    expect(rendersNoTag(channel())).toBe(true);
    expect(rendersNoTag(channel(''))).toBe(true);
    expect(rendersNoTag(channel('div'))).toBe(false);
    expect(rendersNoTag({ ...channel(), definition: { ...channel().definition, type: 'container' } })).toBe(false);
  });
});

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

  it('finds the rules in any class of a stacked selector, not only the first', () => {
    expect(styleWithoutTag(provider({}, 'empty stack'), style)).toBeDefined();
    expect(styleWithoutTag(provider({}, 'empty  empty'), style)).toBeUndefined();
  });
});
