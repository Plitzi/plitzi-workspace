// Packages
import { expect, describe, test } from '@jest/globals';
import get from 'lodash/get';

// Relatives
import FlatMap from './FlatMap';

// Fixtures
import schema1 from '../tests/fixtures/json/schema1.json';
import styleSchema1 from '../tests/fixtures/json/styleSchema1.json';

describe('Testing FlatMap', () => {
  // yarn test FlatMap.test.js -t flatAsTemplate
  test('flatAsTemplate', () => {
    const { elements, elementsStyle, variables } = FlatMap.flatAsTemplate(
      schema1,
      styleSchema1 ?? { platform: { desktop: {}, tablet: {}, mobile: {} }, cache: '' },
      '669b33d56e29e1297a6ccde1'
    );
    expect({ elements, elementsStyle, variables }).toStrictEqual({
      elements: {
        acum: {
          id_0d3d1d: {
            attributes: {
              content: 'Heading',
              subType: 'h1'
            },
            definition: {
              bindings: {},
              initialState: {
                visibility: true
              },
              label: 'Nice Heading',
              parentId: 'id_6ccde1',
              rootId: 'id_6ccde1',
              styleSelectors: {
                base: 'heading-rdGM'
              },
              type: 'heading'
            },
            id: 'id_0d3d1d'
          },
          id_6ccde1: {
            attributes: {
              subType: 'div'
            },
            definition: {
              bindings: {},
              description: 'Group things together into groups, also nestable.',
              initialState: {
                visibility: true
              },
              items: ['id_e21bc6', 'id_0d3d1d'],
              label: 'Container',
              parentId: null,
              rootId: 'id_6ccde1',
              styleSelectors: {
                base: ''
              },
              type: 'container'
            },
            id: 'id_6ccde1'
          },
          id_e21bc6: {
            attributes: {
              content: 'Button',
              contentPlacement: 'after',
              disabled: false,
              subType: 'button'
            },
            definition: {
              bindings: {},
              initialState: {
                visibility: true
              },
              interactions: {
                node_669b33e1847b3149e1223886: {
                  action: 'onClick',
                  afterNode: 'node_669b33e73090472c339a0b52',
                  beforeNode: '',
                  elementId: 'id_e21bc6',
                  enabled: true,
                  flowId: 'node_669b33e1847b3149e1223886',
                  id: 'node_669b33e1847b3149e1223886',
                  params: {
                    propagateEvent: false
                  },
                  preview: {
                    propagateEvent: ''
                  },
                  title: 'New Trigger',
                  type: 'trigger'
                },
                node_669b33e73090472c339a0b52: {
                  action: 'setState',
                  afterNode: '',
                  beforeNode: 'node_669b33e1847b3149e1223886',
                  elementId: 'id_0d3d1d',
                  enabled: true,
                  flowId: 'node_669b33e1847b3149e1223886',
                  id: 'node_669b33e73090472c339a0b52',
                  params: {
                    category: 'attribute',
                    key: 'content',
                    revertOnFinish: false,
                    value: 'Nice one'
                  },
                  preview: {},
                  title: 'New Callback',
                  type: 'callback'
                }
              },
              items: [],
              label: 'Button',
              parentId: 'id_6ccde1',
              rootId: 'id_6ccde1',
              styleSelectors: {
                base: 'button-rdGM'
              },
              type: 'button'
            },
            id: 'id_e21bc6'
          }
        },
        item: {
          attributes: {
            subType: 'div'
          },
          definition: {
            bindings: {},
            description: 'Group things together into groups, also nestable.',
            initialState: {
              visibility: true
            },
            items: ['id_e21bc6', 'id_0d3d1d'],
            label: 'Container',
            parentId: null,
            rootId: 'id_6ccde1',
            styleSelectors: {
              base: ''
            },
            type: 'container'
          },
          id: 'id_6ccde1'
        }
      },
      elementsStyle: {
        cache: '',
        platform: {
          desktop: {
            'heading-rdGM': {
              attributes: {
                'background-color': 'var(--primaryColor)',
                color: 'var(--fancyVariableColor)'
              },
              cache: '.heading-rdGM{color:var(--fancyVariableColor);background-color:var(--primaryColor);}',
              name: 'heading-rdGM',
              type: 'class'
            },
            'button-rdGM': {
              name: 'button-rdGM',
              type: 'class',
              attributes: {
                color: 'var(--fancyVariableColor)',
                'background-color': 'var(--primaryColor)'
              },
              cache: '.button-rdGM{color:var(--fancyVariableColor);background-color:var(--primaryColor);}'
            }
          },
          mobile: {},
          tablet: {}
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
        }
      ]
    });
  });

  test('FlatMap getElementVariables', () => {
    const variables = FlatMap.getElementVariables(
      get(schema1, 'flat', {}),
      '669b33dcf636e501810d3d1d',
      get(schema1, 'variables', []),
      styleSchema1
    );
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
      }
    ]);
  });
});
