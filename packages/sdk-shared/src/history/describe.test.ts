import { describe, expect, it } from 'vitest';

import { describeChange, fieldChanges } from './describe';

import type { ChangeEntry } from './types';

const element = (id: string, type: string, parentId: string | null, items: string[] = [], attributes = {}) => ({
  id,
  attributes,
  definition: { label: id, type, parentId, rootId: 'test', items, styleSelectors: { base: '' } }
});

const texts = (entries: ChangeEntry[]) => describeChange(entries).map(line => line.text);

describe('describeChange', () => {
  it('ties each line about an element to it, so a reader can go there', () => {
    expect(
      describeChange([{ kind: 'element', id: 'hero', op: 'add', after: element('hero', 'text', 'test') }])
    ).toEqual([{ text: 'Added text “hero” to “test”', elementId: 'hero' }]);
  });

  // The case that read "Added element hero; Updated element test": the page only changed because it gained a child.
  it('says an element was added to its page, and not that the page changed as well', () => {
    const entries: ChangeEntry[] = [
      { kind: 'element', id: 'hero', op: 'add', after: element('hero', 'text', 'test') },
      {
        kind: 'element',
        id: 'test',
        op: 'update',
        before: element('test', 'page', null, []),
        after: element('test', 'page', null, ['hero'])
      }
    ];

    expect(texts(entries)).toEqual(['Added text “hero” to page “test”']);
  });

  it('says a move as one line, from where to where', () => {
    const entries: ChangeEntry[] = [
      {
        kind: 'element',
        id: 'cta',
        op: 'update',
        before: element('cta', 'button', 'header'),
        after: element('cta', 'button', 'footer')
      },
      {
        kind: 'element',
        id: 'header',
        op: 'update',
        before: element('header', 'container', 'test', ['cta']),
        after: element('header', 'container', 'test', [])
      },
      {
        kind: 'element',
        id: 'footer',
        op: 'update',
        before: element('footer', 'container', 'test', []),
        after: element('footer', 'container', 'test', ['cta'])
      }
    ];

    expect(texts(entries)).toEqual(['Moved button “cta” from container “header” to container “footer”']);
  });

  it('names the fields that changed, and a reorder nothing else explains', () => {
    const entries: ChangeEntry[] = [
      {
        kind: 'element',
        id: 'title',
        op: 'update',
        before: element('title', 'heading', 'test', [], { content: 'Hi', subType: 'h1' }),
        after: element('title', 'heading', 'test', [], { content: 'Hello', subType: 'h2' })
      },
      {
        kind: 'element',
        id: 'test',
        op: 'update',
        before: element('test', 'page', null, ['a', 'b']),
        after: element('test', 'page', null, ['b', 'a'])
      }
    ];

    expect(texts(entries)).toEqual([
      'Changed content, subType of heading “title”',
      'Reordered the children of page “test”'
    ]);
  });

  it('says a removal from its parent, and each style change with where it applies', () => {
    const entries: ChangeEntry[] = [
      { kind: 'element', id: 'old', op: 'remove', before: element('old', 'image', 'gallery') },
      {
        kind: 'selector',
        id: 'card',
        op: 'update',
        before: { desktop: { a: 1 } },
        after: { desktop: { a: 1 }, tablet: {} }
      },
      { kind: 'token', id: 'color/primary', op: 'update', before: '#000', after: '#111' },
      { kind: 'setting', id: 'pages', op: 'update', before: ['a', 'b'], after: ['b', 'a'] }
    ];

    expect(texts(entries)).toEqual([
      'Removed image “old” from “gallery”',
      'Changed class “card” on tablet',
      'Changed token “color/primary”',
      'Reordered the pages'
    ]);
  });

  it('still says what was touched when the record carries no values', () => {
    expect(texts([{ kind: 'element', id: 'hero', op: 'update' }])).toEqual(['Changed “hero”']);
  });
});

describe('fieldChanges', () => {
  it('names each field that changed inside an entity, and compares lists whole', () => {
    const before = { attributes: { content: 'Hi', href: '/a' }, definition: { items: ['a', 'b'] } };
    const after = { attributes: { content: 'Hello', href: '/a', title: 'T' }, definition: { items: ['b', 'a'] } };

    expect(fieldChanges(before, after)).toEqual([
      { path: 'attributes.content', before: 'Hi', after: 'Hello' },
      { path: 'attributes.title', after: 'T' },
      { path: 'definition.items', before: ['a', 'b'], after: ['b', 'a'] }
    ]);
  });
});
