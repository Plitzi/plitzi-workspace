// Packages
import { expect, describe, test } from '@jest/globals';
import get from 'lodash/get';

// Relatives
import FlatMap from './FlatMap';

// Fixtures
import schema1 from '../tests/fixtures/json/schema1.json';
import styleSchema1 from '../tests/fixtures/json/styleSchema1.json';

describe('Testing FlatMap', () => {
  // yarn test FlatMap.test.js -t cloneNested
  test('cloneNested', () => {
    const { elements, elementsStyle } = FlatMap.flatAsTemplate(
      get(schema1, 'flat', {}),
      styleSchema1 ?? { platform: { desktop: {}, tablet: {}, mobile: {} }, cache: '' },
      '669b33d56e29e1297a6ccde1'
    );
    expect({ elements, elementsStyle }).toStrictEqual({
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
                base: ''
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
                base: ''
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
          desktop: {},
          mobile: {},
          tablet: {}
        }
      }
    });
  });
});
