import { describe, expect, it } from 'vitest';

import { collectServerElements, hasServerElements } from './serverElements';

import type { Element, Schema } from '../types';

const element = (id: string, items: string[] = [], runtime?: 'server' | 'client'): Element => ({
  id,
  attributes: {},
  definition: { type: id, label: id, rootId: 'root', items, styleSelectors: { base: '' }, runtime }
});

const schema = {
  flat: {
    home: element('home', ['homeBox']),
    homeBox: element('homeBox', ['homeApi']),
    homeApi: element('homeApi', [], 'server'),
    post: element('post', ['postApi', 'postText']),
    postApi: element('postApi', [], 'server'),
    postText: element('postText', [], 'client'),
    loop: element('loop', ['loop'])
  },
  pages: ['home', 'post']
} as unknown as Schema;

describe('collectServerElements', () => {
  it('finds a server element nested under plain containers', () => {
    expect(collectServerElements(schema, 'home').map(e => e.id)).toEqual(['homeApi']);
  });

  it('stays inside the page it was asked about', () => {
    expect(collectServerElements(schema, 'post').map(e => e.id)).toEqual(['postApi']);
  });

  it('narrows to the requested ids', () => {
    expect(collectServerElements(schema, 'post', ['postText']).map(e => e.id)).toEqual([]);
  });

  it('answers nothing for a page it cannot find, or for no page at all', () => {
    expect(collectServerElements(schema, 'ghost')).toEqual([]);
    expect(collectServerElements(schema, undefined)).toEqual([]);
  });

  it('terminates on a schema whose items cycle', () => {
    expect(collectServerElements(schema, 'loop')).toEqual([]);
  });
});

describe('hasServerElements', () => {
  it('separates a page that consumes server data from one that does not', () => {
    expect(hasServerElements(schema, 'home')).toBe(true);
    expect(hasServerElements(schema, 'ghost')).toBe(false);
  });
});
