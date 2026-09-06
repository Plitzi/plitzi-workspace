import { produce, setAutoFreeze } from 'immer';
import { describe, it, expect } from 'vitest';

import {
  elementIdConflict,
  elementIdsFree,
  isValidElementId,
  positionalElementId,
  randomElementId,
  remapCollidingIds,
  repointIds,
  slugifyElementId,
  takenIds,
  uniqueElementId
} from './elementId';
import FlatMap from './FlatMap';

import type { Element, Schema } from '@plitzi/sdk-shared';

const element = (id: string, type: string, definition: Partial<Element['definition']> = {}): Element => ({
  id,
  attributes: {},
  definition: { rootId: 'page1', label: id, type, items: [], styleSelectors: { base: '' }, ...definition }
});

const step = (
  overrides: Partial<Element['definition']['interactions']> extends never ? never : Record<string, unknown>
) =>
  ({
    id: 'i1',
    title: 'Step',
    type: 'callback',
    action: 'run',
    params: {},
    preview: {},
    elementId: null,
    beforeNode: '',
    afterNode: '',
    flowId: 'i1',
    enabled: true,
    ...overrides
  }) as NonNullable<Element['definition']['interactions']>[string];

describe('isValidElementId', () => {
  it('accepts a letter start followed by letters, numbers, hyphens and underscores', () => {
    expect(isValidElementId('products-api')).toBe(true);
    expect(isValidElementId('Hero2')).toBe(true);
    expect(isValidElementId('hero_cta')).toBe(true);
  });

  it('requires a letter start, rejecting a digit or hyphen first', () => {
    expect(isValidElementId('1hero')).toBe(false);
    expect(isValidElementId('-hero')).toBe(false);
  });

  it('accepts a single letter and an internal hyphen but not a trailing one', () => {
    expect(isValidElementId('a')).toBe(true);
    expect(isValidElementId('a-b-c')).toBe(true);
    expect(isValidElementId('hero-')).toBe(false);
  });

  it('rejects the dot the source grammar and the lodash flat paths both split on', () => {
    expect(isValidElementId('hero.cta')).toBe(false);
    expect(isValidElementId('hero cta')).toBe(false);
    expect(isValidElementId('')).toBe(false);
  });
});

describe('slugifyElementId', () => {
  it('turns what a person types in the tree into a key this document can hold', () => {
    expect(slugifyElementId('Hero Section')).toBe('Hero-Section');
    expect(slugifyElementId('Precio · Básico')).toBe('Precio-Basico');
    expect(slugifyElementId('  spaced  out  ')).toBe('spaced-out');
  });

  it('drops a leading non-letter rather than producing an id the charset refuses', () => {
    expect(slugifyElementId('2 columns')).toBe('columns');
    expect(isValidElementId(slugifyElementId('2 columns'))).toBe(true);
  });

  it('returns empty when nothing usable survives, which the caller reports instead of storing', () => {
    expect(slugifyElementId('!!!')).toBe('');
  });
});

describe('takenIds', () => {
  it('is every key of the document — an element cannot be present without a name', () => {
    expect(takenIds({ hero: element('hero', 'container'), cta: element('cta', 'button') })).toEqual(
      new Set(['hero', 'cta'])
    );
  });
});

describe('elementIdConflict', () => {
  const flat = { 'products-api': element('products-api', 'apiContainer') };

  it('returns null for a well-formed, free name', () => {
    expect(elementIdConflict(flat, 'orders-api')).toBeNull();
  });

  it('explains a malformed name', () => {
    expect(elementIdConflict(flat, 'hero.cta')).toContain('not a valid name');
  });

  it('explains a name another element owns', () => {
    expect(elementIdConflict(flat, 'products-api')).toContain('already used');
  });

  it('does not report the element being edited against itself', () => {
    expect(elementIdConflict(flat, 'products-api', 'products-api')).toBeNull();
  });
});

describe('elementIdsFree', () => {
  const flat = { 'products-api': element('products-api', 'apiContainer') };

  it('accepts a set of free, well-formed names', () => {
    expect(elementIdsFree(flat, [element('hero', 'container'), element('hero-cta', 'button')])).toBe(true);
  });

  it('rejects a name the document already holds — an element arriving is not the one stored', () => {
    expect(elementIdsFree(flat, [element('products-api', 'apiContainer')])).toBe(false);
  });

  it('rejects a malformed name', () => {
    expect(elementIdsFree(flat, [element('hero.cta', 'button')])).toBe(false);
  });

  it('rejects a name two elements of the same set claim', () => {
    expect(elementIdsFree(flat, [element('hero', 'container'), element('hero', 'button')])).toBe(false);
  });
});

describe('minting', () => {
  it('counts up until it finds a free name, for the offline author', () => {
    expect(positionalElementId('apiContainer', id => ['apiContainer-1', 'apiContainer-2'].includes(id))).toBe(
      'apiContainer-3'
    );
  });

  it('strips characters the charset forbids from the type', () => {
    expect(positionalElementId('my.custom_type', () => false)).toBe('mycustomtype-1');
  });

  it('mints a well-formed, free name for the live document', () => {
    const id = randomElementId('heading', candidate => candidate === 'heading-aaaa');
    expect(id.startsWith('heading-')).toBe(true);
    expect(id).not.toBe('heading-aaaa');
    expect(isValidElementId(id)).toBe(true);
  });
});

describe('uniqueElementId', () => {
  it('keeps the name when it is free', () => {
    expect(uniqueElementId('hero', () => false)).toBe('hero');
  });

  it('degrades readably rather than falling back to the type', () => {
    expect(uniqueElementId('hero', id => ['hero', 'hero-2'].includes(id))).toBe('hero-3');
  });

  it('counts on from a name that already ends in a number instead of stacking another one', () => {
    expect(uniqueElementId('container-1', id => id === 'container-1')).toBe('container-2');
    expect(uniqueElementId('container-1', id => ['container-1', 'container-2'].includes(id))).toBe('container-3');
  });
});

describe('repointIds', () => {
  it('rewrites the structure a rename moves: the key, the identity, parentId, items and rootId', () => {
    const flat: Schema['flat'] = {
      page1: element('page1', 'page', { items: ['hero'], rootId: 'page1' }),
      hero: element('hero', 'container', { parentId: 'page1', items: ['cta'] }),
      cta: element('cta', 'button', { parentId: 'hero' })
    };
    const pages: Schema['pages'] = ['page1'];

    repointIds(flat, { hero: 'banner' }, pages);

    expect(Object.keys(flat).sort()).toEqual(['banner', 'cta', 'page1']);
    expect(flat.banner.id).toBe('banner');
    expect(flat.page1.definition.items).toEqual(['banner']);
    expect(flat.cta.definition.parentId).toBe('banner');
    expect(pages).toEqual(['page1']);
  });

  it('rewrites the page list and the attributes that point at another element', () => {
    const flat: Schema['flat'] = {
      home: element('home', 'page', { rootId: 'home' }),
      shell: element('shell', 'layoutContainer', { rootId: 'shell' }),
      link1: element('link1', 'link')
    };
    flat.home.attributes.layoutContainer = 'shell';
    flat.link1.attributes = { mode: 'page', href: 'home' };
    const pages: Schema['pages'] = ['home'];

    repointIds(flat, { home: 'landing', shell: 'app-shell' }, pages);

    expect(pages).toEqual(['landing']);
    expect(flat.landing.attributes.layoutContainer).toBe('app-shell');
    expect(flat.link1.attributes.href).toBe('landing');
  });

  it('leaves a link href alone when it is not a page reference', () => {
    const flat: Schema['flat'] = { link1: element('link1', 'link') };
    flat.link1.attributes = { mode: 'external', href: 'home' };

    repointIds(flat, { home: 'landing' });

    expect(flat.link1.attributes.href).toBe('home');
  });

  it('rewrites a navigate step that targets a page, and only when it targets one', () => {
    const flat: Schema['flat'] = {
      b: element('b', 'button', {
        interactions: {
          i1: step({ action: 'navigate', elementId: 'navigation', params: { urlType: 'page', url: 'home' } }),
          i2: step({
            id: 'i2',
            action: 'navigate',
            elementId: 'navigation',
            params: { urlType: 'internal', url: 'home' }
          })
        }
      })
    };

    repointIds(flat, { home: 'landing' });

    expect(flat.b.definition.interactions?.i1.params.url).toBe('landing');
    expect(flat.b.definition.interactions?.i2.params.url).toBe('home');
  });

  it('rewrites a binding source and a twig token in a transformer', () => {
    const flat: Schema['flat'] = {
      title: element('title', 'text', {
        bindings: {
          attributes: [
            {
              id: 'b1',
              source: 'apiContainer_card-1.data.name',
              to: 'content',
              transformers: [
                { action: 'twigTemplate', params: { template: 'Hello {{ apiContainer_card-1.data.name }}!' } }
              ]
            }
          ]
        }
      })
    };

    repointIds(flat, { 'card-1': 'card-2' });

    const binding = flat.title.definition.bindings?.attributes?.[0];
    expect(binding?.source).toBe('apiContainer_card-2.data.name');
    expect(binding?.transformers?.[0].params.template).toBe('Hello {{ apiContainer_card-2.data.name }}!');
  });

  it('leaves a bare occurrence of the name in prose alone — only a full <type>_<id> token is rewritten', () => {
    const flat: Schema['flat'] = {
      b: element('b', 'button', {
        interactions: { i1: step({ params: { note: 'the card-1 label stays', url: '{{ list_card-1.item.id }}' } }) }
      })
    };

    repointIds(flat, { 'card-1': 'card-2' });

    const params = flat.b.definition.interactions?.i1.params as Record<string, string>;
    expect(params.note).toBe('the card-1 label stays');
    expect(params.url).toBe('{{ list_card-2.item.id }}');
  });

  it('reports the elements it wrote to under their new names, and nothing it left alone', () => {
    const flat: Schema['flat'] = {
      'products-api': element('products-api', 'apiContainer'),
      title: element('title', 'text', {
        bindings: { attributes: [{ id: 'b1', source: 'apiContainer_products-api.data.name', to: 'content' }] }
      }),
      untouched: element('untouched', 'text')
    };

    expect(repointIds(flat, { 'products-api': 'catalog-api' }).sort()).toEqual(['catalog-api', 'title']);
  });

  it('leaves a source that is not element-scoped alone', () => {
    const flat: Schema['flat'] = {
      field: element('field', 'input', { bindings: { attributes: [{ id: 'b1', source: 'form', to: 'value' }] } })
    };

    repointIds(flat, { form: 'other' });

    expect(flat.field.definition.bindings?.attributes?.[0].source).toBe('form');
  });
});

describe('remapCollidingIds', () => {
  it('keeps the names a template brought and renames only the ones this document already holds', () => {
    const arriving: Schema['flat'] = { hero: element('hero', 'container'), cta: element('cta', 'button') };

    const renamed = remapCollidingIds(arriving, candidate => candidate === 'hero');

    expect(Object.keys(arriving).sort()).toEqual(['cta', 'hero-2']);
    expect(renamed).toEqual({ hero: 'hero-2' });
  });

  it('repoints the arriving set own references onto the renamed element', () => {
    const arriving: Schema['flat'] = {
      hero: element('hero', 'apiContainer'),
      title: element('title', 'text', {
        parentId: 'hero',
        bindings: { attributes: [{ id: 'b1', source: 'apiContainer_hero.data.name', to: 'content' }] }
      })
    };

    remapCollidingIds(arriving, candidate => candidate === 'hero');

    expect(arriving.title.definition.parentId).toBe('hero-2');
    expect(arriving.title.definition.bindings?.attributes?.[0].source).toBe('apiContainer_hero-2.data.name');
  });

  it('never mints a name another arriving element still answers to', () => {
    const arriving: Schema['flat'] = { hero: element('hero', 'container'), 'hero-2': element('hero-2', 'container') };

    remapCollidingIds(arriving, candidate => candidate === 'hero');

    expect(Object.keys(arriving).sort()).toEqual(['hero-2', 'hero-3']);
  });
});

describe('FlatMap.renameElement', () => {
  it('propagates the rename to every binding and interaction that named the old id', () => {
    setAutoFreeze(true);
    const state = produce({ flat: {}, pages: [] } as Pick<Schema, 'flat' | 'pages'>, draft => {
      draft.flat['products-api'] = element('products-api', 'apiContainer');
      draft.flat.title = element('title', 'text', {
        bindings: { attributes: [{ id: 'b1', source: 'apiContainer_products-api.data.name', to: 'content' }] }
      });
      draft.flat.opener = element('opener', 'button', {
        interactions: { i1: step({ action: 'openModal', elementId: 'products-api' }) }
      });
    });

    let touched: Element['id'][] | false = false;
    const next = produce(state, draft => {
      touched = FlatMap.renameElement(draft, 'products-api', 'catalog-api');
    });

    expect(next.flat['products-api']).toBeUndefined();
    expect(next.flat['catalog-api'].id).toBe('catalog-api');
    expect(next.flat.title.definition.bindings?.attributes?.[0].source).toBe('apiContainer_catalog-api.data.name');
    expect(next.flat.opener.definition.interactions?.i1.elementId).toBe('catalog-api');
    // What a broadcast has to publish: the element renamed AND everything repointed with it.
    expect((touched as unknown as string[]).sort()).toEqual(['catalog-api', 'opener', 'title']);
  });

  it('refuses a name another element already answers to, leaving the document untouched', () => {
    const flat: Schema['flat'] = { hero: element('hero', 'container'), cta: element('cta', 'button') };

    expect(FlatMap.renameElement({ flat, pages: [] }, 'hero', 'cta')).toBe(false);
    expect(Object.keys(flat).sort()).toEqual(['cta', 'hero']);
  });

  it('rewrites the page list when the element renamed is a page', () => {
    const flat: Schema['flat'] = { home: element('home', 'page', { rootId: 'home' }) };
    const pages: Schema['pages'] = ['home'];

    expect(FlatMap.renameElement({ flat, pages }, 'home', 'landing')).toEqual(['landing']);
    expect(pages).toEqual(['landing']);
  });
});

describe('FlatMap.cloneElements', () => {
  it('copies a subtree onto readable names derived from the originals', () => {
    const flat: Schema['flat'] = {
      page1: element('page1', 'page', { items: ['hero'], rootId: 'page1' }),
      hero: element('hero', 'container', { parentId: 'page1', items: ['cta'] }),
      cta: element('cta', 'button', { parentId: 'hero' })
    };

    const { acum, item } = FlatMap.cloneElements(flat, 'hero');

    expect(item?.id).toBe('hero-2');
    expect(Object.keys(acum).sort()).toEqual(['cta-2', 'hero-2']);
    expect(acum['cta-2'].definition.parentId).toBe('hero-2');
    expect(acum['hero-2'].definition.items).toEqual(['cta-2']);
  });

  it('never rewrites an id that merely appears inside content, a label or a class name', () => {
    // The reason this is a structural pass and not a string replace over the serialized tree. With hex ids the
    // replace was safe by accident; with `hero` as a name it corrupts every sentence containing the word.
    const flat: Schema['flat'] = {
      hero: element('hero', 'container', { items: ['copy'], label: 'hero' }),
      copy: element('copy', 'text', { parentId: 'hero', styleSelectors: { base: 'hero-title' } })
    };
    flat.copy.attributes.content = 'Our hero is the copy on this page';

    const { acum } = FlatMap.cloneElements(flat, 'hero');

    expect(acum['copy-2'].attributes.content).toBe('Our hero is the copy on this page');
    expect(acum['copy-2'].definition.styleSelectors.base).toBe('hero-title');
    expect(acum['hero-2'].definition.label).toBe('hero');
  });

  it('repoints a binding at the copy of its provider and leaves one pointing outside the subtree alone', () => {
    const flat: Schema['flat'] = {
      api: element('api', 'apiContainer', { items: ['title'] }),
      title: element('title', 'text', {
        parentId: 'api',
        bindings: {
          attributes: [
            { id: 'b1', source: 'apiContainer_api.data.name', to: 'content' },
            { id: 'b2', source: 'apiContainer_external.data.name', to: 'title' }
          ]
        }
      })
    };

    const { acum } = FlatMap.cloneElements(flat, 'api');

    const bindings = acum['title-2'].definition.bindings?.attributes;
    expect(bindings?.[0].source).toBe('apiContainer_api-2.data.name');
    expect(bindings?.[1].source).toBe('apiContainer_external.data.name');
  });

  it('leaves the originals untouched', () => {
    const flat: Schema['flat'] = {
      hero: element('hero', 'container', { items: ['cta'] }),
      cta: element('cta', 'button', { parentId: 'hero' })
    };

    FlatMap.cloneElements(flat, 'hero');

    expect(Object.keys(flat).sort()).toEqual(['cta', 'hero']);
    expect(flat.hero.definition.items).toEqual(['cta']);
  });
});
