import { produce, setAutoFreeze } from 'immer';
import { describe, it, expect } from 'vitest';

import FlatMap from './FlatMap';
import {
  idRefConflict,
  idRefsUsable,
  isValidIdRef,
  makeIdRef,
  remapClonedRefs,
  repointIdRefs,
  takenIdRefs
} from './idRef';

import type { Element, Schema } from '@plitzi/sdk-shared';

const element = (
  id: string,
  idRef: string,
  type: string,
  definition: Partial<Element['definition']> = {}
): Element => ({
  id,
  idRef,
  attributes: {},
  definition: { rootId: 'page1', label: id, type, items: [], styleSelectors: { base: '' }, ...definition }
});

describe('isValidIdRef', () => {
  it('accepts a letter start followed by letters, numbers, hyphens and underscores', () => {
    expect(isValidIdRef('products-api')).toBe(true);
    expect(isValidIdRef('Hero2')).toBe(true);
    expect(isValidIdRef('hero_cta')).toBe(true);
    expect(isValidIdRef('my_list_card')).toBe(true);
  });

  it('requires a letter start, rejecting a digit or hyphen first', () => {
    expect(isValidIdRef('1hero')).toBe(false);
    expect(isValidIdRef('2products-api')).toBe(false);
    expect(isValidIdRef('-hero')).toBe(false);
  });

  it('accepts a single letter and an internal hyphen but not a trailing one', () => {
    expect(isValidIdRef('a')).toBe(true);
    expect(isValidIdRef('a-b-c')).toBe(true);
    expect(isValidIdRef('hero-')).toBe(false);
  });

  it('rejects the dot separator the source grammar uses, spaces, and the empty ref', () => {
    // A '.' splits `<type>_<idRef>.<field>` — so it is not allowed.
    expect(isValidIdRef('hero.cta')).toBe(false);
    expect(isValidIdRef('hero cta')).toBe(false);
    expect(isValidIdRef('')).toBe(false);
  });
});

describe('takenIdRefs', () => {
  it('collects the refs in use, skipping elements without one', () => {
    const flat = { a: element('a', 'hero', 'container'), b: { ...element('b', 'x', 'text'), idRef: undefined } };

    expect(takenIdRefs(flat)).toEqual(new Set(['hero']));
  });
});

describe('idRefConflict', () => {
  const flat = { a: element('a', 'products-api', 'apiContainer') };

  it('returns null for a well-formed, free ref', () => {
    expect(idRefConflict(flat, 'orders-api')).toBeNull();
  });

  it('explains a malformed ref', () => {
    expect(idRefConflict(flat, 'hero.cta')).toContain('not a valid reference');
  });

  it('explains a ref another element owns', () => {
    expect(idRefConflict(flat, 'products-api')).toContain('already used');
  });

  it('does not report the element being edited against itself', () => {
    expect(idRefConflict(flat, 'products-api', 'a')).toBeNull();
  });
});

describe('idRefsUsable', () => {
  const flat = { a: element('a', 'products-api', 'apiContainer') };

  it('accepts a set of free, well-formed refs', () => {
    expect(idRefsUsable(flat, [element('b', 'hero', 'container'), element('c', 'hero-cta', 'button')])).toBe(true);
  });

  it('accepts elements arriving without a ref', () => {
    expect(idRefsUsable(flat, [{ ...element('b', 'x', 'text'), idRef: undefined }])).toBe(true);
  });

  it('rejects a ref another element already owns', () => {
    expect(idRefsUsable(flat, [element('b', 'products-api', 'apiContainer')])).toBe(false);
  });

  it('rejects a malformed ref', () => {
    expect(idRefsUsable(flat, [element('b', 'hero.cta', 'button')])).toBe(false);
  });

  it('does not report an element already stored against itself', () => {
    expect(idRefsUsable(flat, [element('a', 'products-api', 'apiContainer')])).toBe(true);
  });

  it('rejects a ref two elements of the same set claim', () => {
    expect(idRefsUsable(flat, [element('b', 'hero', 'container'), element('c', 'hero', 'button')])).toBe(false);
  });
});

describe('makeIdRef', () => {
  it('counts up until it finds a free ref', () => {
    expect(makeIdRef('apiContainer', ref => ['apiContainer-1', 'apiContainer-2'].includes(ref))).toBe('apiContainer-3');
  });

  it('strips characters the charset forbids from the type', () => {
    expect(makeIdRef('my.custom_type', () => false)).toBe('mycustomtype-1');
  });
});

describe('remapClonedRefs', () => {
  it('mints a fresh idRef for every element in the cloned subtree', () => {
    const elements = { a: element('a', 'api-1', 'apiContainer'), b: element('b', 'text-1', 'text') };
    // The originals stay in the space, so their refs are taken — this is what cloneElements passes.
    remapClonedRefs(elements, candidate => ['api-1', 'text-1'].includes(candidate));

    expect(elements.a.idRef).toBe('apiContainer-1');
    expect(elements.b.idRef).toBe('text-2');
  });

  it('skips idRefs already taken elsewhere in the space', () => {
    const elements = { a: element('a', 'api-1', 'apiContainer') };
    remapClonedRefs(elements, candidate => ['apiContainer-1', 'apiContainer-2'].includes(candidate));

    expect(elements.a.idRef).toBe('apiContainer-3');
  });

  it('repoints a binding that targets a provider inside the subtree at the copy, not the original', () => {
    const elements = {
      a: element('a', 'products-api', 'apiContainer'),
      b: element('b', 'title', 'text', {
        bindings: { attributes: [{ id: 'b1', source: 'apiContainer_products-api.data.name', to: 'content' }] }
      })
    };
    remapClonedRefs(elements, () => false);

    expect(elements.b.definition.bindings?.attributes?.[0].source).toBe(`apiContainer_${elements.a.idRef}.data.name`);
  });

  it('leaves a binding that targets a provider outside the subtree pointing outward', () => {
    const elements = {
      b: element('b', 'title', 'text', {
        bindings: { attributes: [{ id: 'b1', source: 'apiContainer_external-api.data.name', to: 'content' }] }
      })
    };
    remapClonedRefs(elements, () => false);

    expect(elements.b.definition.bindings?.attributes?.[0].source).toBe('apiContainer_external-api.data.name');
  });

  it('leaves a source that is not element-scoped alone', () => {
    const elements = {
      b: element('b', 'field', 'input', { bindings: { attributes: [{ id: 'b1', source: 'form', to: 'value' }] } })
    };
    remapClonedRefs(elements, () => false);

    expect(elements.b.definition.bindings?.attributes?.[0].source).toBe('form');
  });

  it('repoints an interaction that targets an element inside the subtree', () => {
    const elements = {
      a: element('a', 'my-modal', 'modalContainer'),
      b: element('b', 'opener', 'button', {
        interactions: {
          i1: {
            id: 'i1',
            title: 'Open',
            type: 'callback',
            action: 'openModal',
            params: {},
            preview: {},
            elementId: 'my-modal',
            beforeNode: '',
            afterNode: '',
            flowId: 'f1',
            enabled: true
          }
        }
      })
    };
    remapClonedRefs(elements, () => false);

    expect(elements.b.definition.interactions?.i1.elementId).toBe(elements.a.idRef);
  });
});

describe('repointIdRefs', () => {
  it('still repoints a binding whose source matches the rename', () => {
    const elements = {
      b: element('b', 'title', 'text', {
        bindings: { attributes: [{ id: 'b1', source: 'apiContainer_card-1.data.name', to: 'content' }] }
      })
    };
    repointIdRefs(elements, { 'card-1': 'card-2' });

    expect(elements.b.definition.bindings?.attributes?.[0].source).toBe('apiContainer_card-2.data.name');
  });

  it('repoints a twig token inside a binding transformer template', () => {
    const elements = {
      b: element('b', 'title', 'text', {
        bindings: {
          attributes: [
            {
              id: 'b1',
              source: 'source',
              to: 'content',
              transformers: [
                { action: 'twigTemplate', params: { template: 'Hello {{ apiContainer_card-1.data.name }}!' } }
              ]
            }
          ]
        }
      })
    };
    repointIdRefs(elements, { 'card-1': 'card-2' });

    expect(elements.b.definition.bindings?.attributes?.[0].transformers?.[0].params.template).toBe(
      'Hello {{ apiContainer_card-2.data.name }}!'
    );
  });

  it('repoints a token inside an interaction param but leaves prose and node_<id> flow refs alone', () => {
    const elements = {
      b: element('b', 'opener', 'button', {
        interactions: {
          i1: {
            id: 'i1',
            title: 'Open',
            type: 'callback',
            action: 'run',
            params: {
              url: '{{ list_card-1.item.id }}',
              from: '{{ node_65bcebd45b7e990c363f45af.details.username }}',
              note: 'the card-1 label stays'
            },
            preview: {},
            elementId: 'someone-else',
            beforeNode: '',
            afterNode: '',
            flowId: 'f1',
            enabled: true
          }
        }
      })
    };
    repointIdRefs(elements, { 'card-1': 'card-2' });

    const params = elements.b.definition.interactions?.i1.params as Record<string, string>;
    expect(params.url).toBe('{{ list_card-2.item.id }}');
    expect(params.from).toBe('{{ node_65bcebd45b7e990c363f45af.details.username }}');
    expect(params.note).toBe('the card-1 label stays');
  });

  it('leaves a bare idRef occurrence untouched — only a full <type>_<idRef> token is rewritten', () => {
    const elements = {
      b: element('b', 'title', 'text', {
        interactions: {
          i1: {
            id: 'i1',
            title: 'x',
            type: 'callback',
            action: 'run',
            params: { label: 'card-1' },
            preview: {},
            elementId: 'other',
            beforeNode: '',
            afterNode: '',
            flowId: 'f1',
            enabled: true
          }
        }
      })
    };
    repointIdRefs(elements, { 'card-1': 'card-2' });

    expect((elements.b.definition.interactions?.i1.params as Record<string, string>).label).toBe('card-1');
  });
});

describe('FlatMap.updateElement rename inside an Immer producer', () => {
  it('renames an element whose siblings carry deeply frozen bindings without throwing', () => {
    // A rename runs through the schema reducer's `produce`, where the sibling elements are the deeply frozen
    // base state. FlatMap assigns the caller's plain element over the draft, then repoints every ref across the
    // space — rewriting an unchanged source in place would assign to a read-only property and throw.
    setAutoFreeze(true);
    const state = produce({ flat: {} } as Pick<Schema, 'flat'>, draft => {
      draft.flat.a = element('a', 'card-1', 'text', {
        bindings: { attributes: [{ id: 'a1', source: 'apiContainer_external.data.name', to: 'content' }] }
      });
      draft.flat.b = element('b', 'title', 'text', {
        bindings: { attributes: [{ id: 'b1', source: 'apiContainer_untouched.data.name', to: 'content' }] }
      });
    });

    // The caller hands FlatMap a plain element built from the frozen store element, so its nested binding is
    // still the frozen reference — the exact shape that made the in-place rewrite throw.
    const renamed: Element = { ...state.flat.a, idRef: 'card-2' };

    const next = produce(state, draft => {
      expect(FlatMap.updateElement(draft.flat, renamed)).toBe(true);
    });

    expect(next.flat.a.idRef).toBe('card-2');
    expect(next.flat.a.definition.bindings?.attributes?.[0].source).toBe('apiContainer_external.data.name');
    expect(next.flat.b.definition.bindings?.attributes?.[0].source).toBe('apiContainer_untouched.data.name');
  });

  it('propagates the rename to every sibling binding and interaction that targets the old idRef', () => {
    setAutoFreeze(true);
    const state = produce({ flat: {} } as Pick<Schema, 'flat'>, draft => {
      draft.flat.a = element('a', 'products-api', 'apiContainer');
      draft.flat.b = element('b', 'title', 'text', {
        bindings: { attributes: [{ id: 'b1', source: 'apiContainer_products-api.data.name', to: 'content' }] }
      });
      draft.flat.c = element('c', 'opener', 'button', {
        interactions: {
          i1: {
            id: 'i1',
            title: 'Open',
            type: 'callback',
            action: 'openModal',
            params: {},
            preview: {},
            elementId: 'products-api',
            beforeNode: '',
            afterNode: '',
            flowId: 'f1',
            enabled: true
          }
        }
      });
    });

    const renamed: Element = { ...state.flat.a, idRef: 'catalog-api' };

    const next = produce(state, draft => {
      expect(FlatMap.updateElement(draft.flat, renamed)).toBe(true);
    });

    expect(next.flat.a.idRef).toBe('catalog-api');
    expect(next.flat.b.definition.bindings?.attributes?.[0].source).toBe('apiContainer_catalog-api.data.name');
    expect(next.flat.c.definition.interactions?.i1.elementId).toBe('catalog-api');
  });

  it('rewrites the renamed element own frozen transformer token, which needs a writable copy of the element', () => {
    // The renamed element references its own old idRef through a transformer twig token. That value is a frozen
    // reference on the caller's element, so repointing it demands the stored element be a writable clone.
    setAutoFreeze(true);
    const state = produce({ flat: {} } as Pick<Schema, 'flat'>, draft => {
      draft.flat.a = element('a', 'card-1', 'apiContainer', {
        bindings: {
          attributes: [
            {
              id: 'a1',
              source: 'source',
              to: 'content',
              transformers: [{ action: 'twigTemplate', params: { template: '{{ apiContainer_card-1.data.total }}' } }]
            }
          ]
        }
      });
    });

    const renamed: Element = { ...state.flat.a, idRef: 'card-2' };

    const next = produce(state, draft => {
      expect(FlatMap.updateElement(draft.flat, renamed)).toBe(true);
    });

    expect(next.flat.a.idRef).toBe('card-2');
    expect(next.flat.a.definition.bindings?.attributes?.[0].transformers?.[0].params.template).toBe(
      '{{ apiContainer_card-2.data.total }}'
    );
  });
});
