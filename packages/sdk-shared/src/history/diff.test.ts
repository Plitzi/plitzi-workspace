import { describe, expect, it } from 'vitest';

import { diffSchema, diffStyle, sameValue } from './diff';

import type { HistorySchema, HistoryStyle } from './diff';
import type { Element, StyleItem } from '../types';

const element = (id: string, content = ''): Element => ({
  id,
  attributes: { content },
  definition: { label: id, type: 'text', parentId: 'home', rootId: 'home', items: [], styleSelectors: { base: '' } }
});

const schema = (flat: Record<string, Element>, extra: Partial<HistorySchema> = {}): Partial<HistorySchema> => ({
  flat,
  pages: ['home'],
  pageFolders: [],
  variables: [],
  settings: { customCss: '' },
  definition: { name: 'Site', permanentUrl: 'site' },
  ...extra
});

const selector = (name: string, color: string, type: StyleItem['type'] = 'class'): StyleItem => ({
  name,
  type,
  attributes: {},
  cache: `.${name}{color:${color}}`
});

describe('sameValue', () => {
  it('compares stored documents by content, and a missing key like an undefined one', () => {
    expect(sameValue({ a: [1, { b: 'x' }] }, { a: [1, { b: 'x' }] })).toBe(true);
    expect(sameValue({ a: 1, b: undefined }, { a: 1 })).toBe(true);
    expect(sameValue({ a: [1, 2] }, { a: [2, 1] })).toBe(false);
    expect(sameValue([], {})).toBe(false);
    expect(sameValue(null, {})).toBe(false);
  });
});

describe('diffSchema', () => {
  it('records nothing for a save that changed nothing', () => {
    const flat = { hero: element('hero', 'Hi') };

    expect(diffSchema(schema(flat), schema(structuredClone(flat)))).toEqual([]);
  });

  it('names each element added, updated and removed, whole before and after', () => {
    const before = schema({ hero: element('hero', 'Hi'), old: element('old') });
    const after = schema({ hero: element('hero', 'Hello'), fresh: element('fresh') });

    expect(diffSchema(before, after)).toEqual([
      { kind: 'element', id: 'hero', op: 'update', before: element('hero', 'Hi'), after: element('hero', 'Hello') },
      { kind: 'element', id: 'fresh', op: 'add', after: element('fresh') },
      { kind: 'element', id: 'old', op: 'remove', before: element('old') }
    ]);
  });

  it('keys folders by id, variables by name, and each setting and the page order on its own', () => {
    const before = schema(
      {},
      { variables: [{ name: 'api', type: 'text', value: 'a', category: 'general', subValues: [] }] }
    );
    const after = schema(
      {},
      {
        pages: ['home', 'about'],
        pageFolders: [{ id: 'blog', name: 'Blog', slug: 'blog' }],
        variables: [{ name: 'api', type: 'text', value: 'b', category: 'general', subValues: [] }],
        settings: { customCss: 'body{}' }
      }
    );

    expect(diffSchema(before, after).map(({ kind, id, op }) => `${op} ${kind} ${id}`)).toEqual([
      'add folder blog',
      'update variable api',
      'update setting settings.customCss',
      'update setting pages'
    ]);
  });
});

describe('diffStyle', () => {
  it('holds a selector as one entity across display modes, and tells classes, globals and ids apart', () => {
    const before: Partial<HistoryStyle> = {
      platform: { desktop: { card: selector('card', 'red') }, tablet: {}, mobile: {} },
      variables: { color: { primary: '#000' } },
      fonts: []
    };
    const after: Partial<HistoryStyle> = {
      platform: {
        desktop: { card: selector('card', 'red'), button: selector('button', 'blue', 'element') },
        tablet: { card: selector('card', 'green') },
        mobile: {}
      },
      variables: { color: { primary: '#111' } },
      fonts: []
    };

    expect(diffStyle(before, after)).toEqual([
      {
        kind: 'selector',
        id: 'card',
        op: 'update',
        before: { desktop: selector('card', 'red') },
        after: { desktop: selector('card', 'red'), tablet: selector('card', 'green') }
      },
      { kind: 'globalStyle', id: 'button', op: 'add', after: { desktop: selector('button', 'blue', 'element') } },
      { kind: 'token', id: 'color/primary', op: 'update', before: '#000', after: '#111' }
    ]);
  });
});
