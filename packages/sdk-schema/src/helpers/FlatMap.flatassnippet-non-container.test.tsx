import { cloneDeep } from '@plitzi/plitzi-ui/helpers';
import { describe, it, expect } from 'vitest';

import { EMPTY_STYLE_SCHEMA } from '@plitzi/sdk-shared/style';

import FlatMap from './FlatMap';
import schema1 from '../tests/fixtures/json/schema1.json';
import styleSchema1 from '../tests/fixtures/json/styleSchema1.json';
import styleSchema2 from '../tests/fixtures/json/styleSchema2.json';

import type { Schema, Style } from '@plitzi/sdk-shared';

describe('Testing FlatMap', () => {
  it('flatAsSnippet - non-container element', () => {
    const instance = new FlatMap({
      flat: cloneDeep(schema1.flat) as Schema['flat'],
      variables: cloneDeep(schema1.variables) as Schema['variables']
    });
    const { elements, elementsStyle, variables } = instance.flatAsSnippet(styleSchema1 as Style, 'title');
    expect({ elements, elementsStyle, variables }).toStrictEqual({
      elements: {
        acum: {
          'title-2': {
            id: 'title-2',
            attributes: {
              content: 'Heading',
              subType: 'h1'
            },
            definition: {
              label: 'Nice Heading',
              type: 'heading',
              bindings: {},
              styleSelectors: {
                base: 'heading-rdGM'
              },
              initialState: {
                visibility: true
              },
              rootId: 'title-2'
            }
          }
        },
        item: {
          id: 'title-2',
          attributes: {
            content: 'Heading',
            subType: 'h1'
          },
          definition: {
            label: 'Nice Heading',
            type: 'heading',
            bindings: {},
            styleSelectors: {
              base: 'heading-rdGM'
            },
            initialState: {
              visibility: true
            },
            rootId: 'title-2'
          }
        }
      },
      elementsStyle: {
        cache: '',
        fonts: [],
        mode: 'desktop-first',
        platform: {
          desktop: {
            'heading-rdGM': {
              name: 'heading-rdGM',
              type: 'class',
              attributes: {
                base: {
                  default: {
                    'background-color': 'var(--primaryColor)',
                    color: 'var(--fancyVariableColor)'
                  }
                }
              },
              cache: '.heading-rdGM{color:var(--fancyVariableColor);background-color:var(--primaryColor);}'
            }
          },
          mobile: {},
          tablet: {}
        },
        variables: {},
        theme: {
          default: 'system',
          schemes: ['light', 'dark']
        }
      },
      variables: [
        {
          name: 'fancyVariableColor',
          category: '',
          type: 'color',
          value: 'green',
          subValues: [
            {
              when: {
                id: '1109c974-3bd1-49cc-85ac-1b7826c887e0',
                combinator: 'and',
                rules: [
                  {
                    id: '7ec37a9f-9e85-4413-b16e-f42ac439407e',
                    field: 'queryParams.test',
                    operator: '=',
                    value: 'test',
                    enabled: true
                  }
                ]
              },
              value: 'red'
            },
            {
              value: 'orange',
              when: {
                id: 'b29c4db6-2b5f-42e1-9799-5ce0ccb90ab0',
                combinator: 'and',
                rules: [
                  {
                    id: '1273f0b3-7361-464f-8d63-ae93ac39c79a',
                    field: 'queryParams.test',
                    operator: '=',
                    value: 'test2',
                    enabled: true
                  }
                ]
              }
            }
          ]
        },
        {
          category: '',
          name: 'primaryColor',
          subValues: [],
          type: 'text',
          value: 'purple'
        }
      ]
    });
  });
  it('flatAsSnippet - copies global element styles (type element)', () => {
    const instance = new FlatMap({
      flat: cloneDeep(schema1.flat) as Schema['flat'],
      variables: cloneDeep(schema1.variables) as Schema['variables']
    });
    const { elementsStyle, variables } = instance.flatAsSnippet(styleSchema2 as Style, 'title');
    expect({ elementsStyle, variables }).toStrictEqual({
      elementsStyle: {
        cache: '',
        fonts: [],
        mode: 'desktop-first',
        platform: {
          desktop: {
            'heading-rdGM': {
              name: 'heading-rdGM',
              type: 'class',
              attributes: {
                base: {
                  default: {
                    'font-weight': 'bold'
                  }
                }
              },
              cache: '.heading-rdGM{font-weight:bold;}'
            },
            heading: {
              name: 'heading',
              type: 'element',
              componentType: 'heading',
              attributes: {
                base: {
                  default: {
                    'font-size': '24px'
                  }
                }
              },
              cache: 'heading{font-size:24px;}'
            }
          },
          mobile: {},
          tablet: {}
        },
        variables: {},
        theme: {
          default: 'system',
          schemes: ['light', 'dark']
        }
      },
      variables: []
    });
  });
  it('FlatMap getElementVariables', () => {
    const instance = new FlatMap({
      flat: cloneDeep(schema1.flat) as Schema['flat'],
      variables: cloneDeep(schema1.variables) as Schema['variables']
    });
    const variables = instance.getElementVariables(styleSchema1 as Style, 'title');
    expect(variables).toEqual([
      {
        name: 'fancyVariableColor',
        category: '',
        type: 'color',
        value: 'green',
        subValues: [
          {
            when: {
              id: '1109c974-3bd1-49cc-85ac-1b7826c887e0',
              combinator: 'and',
              rules: [
                {
                  id: '7ec37a9f-9e85-4413-b16e-f42ac439407e',
                  field: 'queryParams.test',
                  operator: '=',
                  value: 'test',
                  enabled: true
                }
              ]
            },
            value: 'red'
          },
          {
            value: 'orange',
            when: {
              id: 'b29c4db6-2b5f-42e1-9799-5ce0ccb90ab0',
              combinator: 'and',
              rules: [
                {
                  id: '1273f0b3-7361-464f-8d63-ae93ac39c79a',
                  field: 'queryParams.test',
                  operator: '=',
                  value: 'test2',
                  enabled: true
                }
              ]
            }
          }
        ]
      },
      {
        category: '',
        name: 'primaryColor',
        subValues: [],
        type: 'text',
        value: 'purple'
      }
    ]);
  });
});
describe('FlatMap.flatAsSnippet', () => {
  it('flatAsSnippet carries every class of a stacked selector', () => {
    const element = (id: string, parentId: string, type: string, base: string, items: string[] = []) => ({
      id,
      attributes: {},
      definition: { rootId: 'home', parentId, label: type, type, items, styleSelectors: { base } }
    });
    const instance = new FlatMap({
      flat: {
        home: {
          id: 'home',
          attributes: {},
          definition: { rootId: 'home', label: 'Page', type: 'page', items: ['card'], styleSelectors: { base: '' } }
        },
        card: element('card', 'home', 'container', 'panel wide', ['title']),
        title: element('title', 'card', 'text', 'label accent')
      },
      variables: []
    });
    const item = (name: string) => ({
      name,
      type: 'class' as const,
      cache: '',
      attributes: { base: { default: { color: 'red' } } }
    });
    const style: Style = {
      ...EMPTY_STYLE_SCHEMA,
      platform: {
        desktop: Object.fromEntries(['panel', 'wide', 'label', 'accent', 'unused'].map(name => [name, item(name)])),
        tablet: {},
        mobile: {}
      }
    };

    const { elementsStyle } = instance.flatAsSnippet(style, 'card');

    expect(Object.keys(elementsStyle.platform.desktop).sort()).toEqual(['accent', 'label', 'panel', 'wide']);
  });
});
describe('FlatMap.moveElement', () => {
  const node = (id: string, type: string, rootId: string, parentId?: string, items: string[] = []) => ({
    id,
    attributes: {},
    definition: { label: id, type, rootId, parentId, items, styleSelectors: { base: '' } }
  });
  const tree = (): Schema['flat'] => ({
    home: node('home', 'page', 'home', undefined, ['box']),
    box: node('box', 'container', 'home', 'home', ['inner']),
    inner: node('inner', 'container', 'home', 'box', ['leaf']),
    leaf: node('leaf', 'text', 'home', 'inner'),
    about: node('about', 'page', 'about', undefined, ['slot']),
    slot: node('slot', 'container', 'about', 'about')
  });

  it('refuses to move an element inside itself or one of its descendants', () => {
    const flat = tree();

    expect(new FlatMap({ flat }).moveElement('home', 'box', 'box', 'inside')).toBe(false);
    expect(new FlatMap({ flat }).moveElement('home', 'leaf', 'box', 'inside')).toBe(false);
    expect(flat.home.definition.items).toEqual(['box']);
  });

  it('takes the subtree to the root it moved into', () => {
    const flat = tree();

    expect(new FlatMap({ flat }).moveElement('box', 'slot', 'inner', 'inside')).toBe(true);
    expect([flat.inner.definition.rootId, flat.leaf.definition.rootId]).toEqual(['about', 'about']);
    expect(flat.slot.definition.items).toEqual(['inner']);
    expect(flat.box.definition.items).toEqual([]);
  });

  it('does not hang on parents that name each other', () => {
    const flat = { ...tree(), a: node('a', 'container', 'x', 'b'), b: node('b', 'container', 'x', 'a') };

    expect(new FlatMap({ flat }).moveElement('home', 'a', 'box', 'inside')).toBe(true);
  });
});
