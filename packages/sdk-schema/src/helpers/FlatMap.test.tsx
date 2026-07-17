import { cloneDeep } from '@plitzi/plitzi-ui/helpers';
import { describe, it, expect } from 'vitest';

import FlatMap from './FlatMap';
import schema1 from '../tests/fixtures/json/schema1.json';
import styleSchema1 from '../tests/fixtures/json/styleSchema1.json';
import styleSchema2 from '../tests/fixtures/json/styleSchema2.json';

import type { DropPosition, Schema, Style } from '@plitzi/sdk-shared';

describe('Testing FlatMap', () => {
  const flat = {
    '62f70064f2882d5ee31dcf71': {
      id: '62f70064f2882d5ee31dcf71',
      definition: {
        label: 'Page',
        type: 'page',
        bindings: {},
        parentId: undefined,
        rootId: '62f70064f2882d5ee31dcf71',
        items: [],
        styleSelectors: {
          base: ''
        }
      },
      attributes: {
        slug: '',
        default: true,
        name: 'Home'
      }
    },
    '62f70064f2882d5ee31dcf72': {
      id: '62f70064f2882d5ee31dcf72',
      definition: {
        label: 'Page',
        type: 'page',
        bindings: {},
        parentId: undefined,
        rootId: '62f70064f2882d5ee31dcf72',
        items: [],
        styleSelectors: {
          base: ''
        }
      },
      attributes: {
        slug: '',
        default: false,
        name: 'Page 2'
      }
    }
  };
  const element1 = {
    id: '62f89157c38ce9ef02b7a5a6',
    attributes: {
      subType: 'h1',
      content: 'Heading 1'
    },
    definition: {
      label: 'Heading',
      type: 'heading',
      bindings: {},
      rootId: '',
      parentId: '',
      styleSelectors: {
        base: ''
      }
    }
  };
  const element2 = {
    id: '62f8c677a4dcde9ce010a397',
    attributes: {
      subType: 'h1',
      content: 'Heading 2'
    },
    definition: {
      label: 'Heading',
      type: 'heading',
      bindings: {},
      rootId: '',
      parentId: '',
      styleSelectors: {
        base: ''
      }
    }
  };
  const element3 = {
    id: '62cbd2570eedfd5fee5df93d',
    attributes: {},
    definition: {
      label: 'Button',
      type: 'button',
      bindings: {},
      rootId: '',
      parentId: '',
      styleSelectors: {
        base: ''
      }
    }
  };

  it('FlatMap Add Element', () => {
    const instance = new FlatMap({ flat: cloneDeep(flat) });
    expect(instance instanceof FlatMap).toBe(true);
    expect(instance.addElement(element1, '62f70064f2882d5ee31dcf71', 'inside')).toBe(true);
    expect(instance.flat).toStrictEqual({
      '62f70064f2882d5ee31dcf71': {
        id: '62f70064f2882d5ee31dcf71',
        definition: {
          label: 'Page',
          type: 'page',
          bindings: {},
          parentId: undefined,
          rootId: '62f70064f2882d5ee31dcf71',
          items: ['62f89157c38ce9ef02b7a5a6'],
          styleSelectors: {
            base: ''
          }
        },
        attributes: {
          slug: '',
          default: true,
          name: 'Home'
        }
      },
      '62f70064f2882d5ee31dcf72': {
        id: '62f70064f2882d5ee31dcf72',
        definition: {
          label: 'Page',
          type: 'page',
          bindings: {},
          parentId: undefined,
          rootId: '62f70064f2882d5ee31dcf72',
          items: [],
          styleSelectors: {
            base: ''
          }
        },
        attributes: {
          slug: '',
          default: false,
          name: 'Page 2'
        }
      },
      '62f89157c38ce9ef02b7a5a6': {
        id: '62f89157c38ce9ef02b7a5a6',
        attributes: {
          subType: 'h1',
          content: 'Heading 1'
        },
        definition: {
          label: 'Heading',
          type: 'heading',
          bindings: {},
          rootId: '62f70064f2882d5ee31dcf71',
          parentId: '62f70064f2882d5ee31dcf71',
          styleSelectors: {
            base: ''
          }
        }
      }
    });

    expect(instance.addElement(element2, '62f89157c38ce9ef02b7a5a6', 'top')).toBe(true);
    expect(instance.flat).toStrictEqual({
      '62f70064f2882d5ee31dcf71': {
        id: '62f70064f2882d5ee31dcf71',
        definition: {
          label: 'Page',
          type: 'page',
          bindings: {},
          parentId: undefined,
          rootId: '62f70064f2882d5ee31dcf71',
          items: ['62f8c677a4dcde9ce010a397', '62f89157c38ce9ef02b7a5a6'],
          styleSelectors: {
            base: ''
          }
        },
        attributes: {
          slug: '',
          default: true,
          name: 'Home'
        }
      },
      '62f70064f2882d5ee31dcf72': {
        id: '62f70064f2882d5ee31dcf72',
        definition: {
          label: 'Page',
          type: 'page',
          bindings: {},
          parentId: undefined,
          rootId: '62f70064f2882d5ee31dcf72',
          items: [],
          styleSelectors: {
            base: ''
          }
        },
        attributes: {
          slug: '',
          default: false,
          name: 'Page 2'
        }
      },
      '62f89157c38ce9ef02b7a5a6': {
        id: '62f89157c38ce9ef02b7a5a6',
        attributes: {
          subType: 'h1',
          content: 'Heading 1'
        },
        definition: {
          label: 'Heading',
          type: 'heading',
          bindings: {},
          rootId: '62f70064f2882d5ee31dcf71',
          parentId: '62f70064f2882d5ee31dcf71',
          styleSelectors: {
            base: ''
          }
        }
      },
      '62f8c677a4dcde9ce010a397': {
        id: '62f8c677a4dcde9ce010a397',
        attributes: {
          subType: 'h1',
          content: 'Heading 2'
        },
        definition: {
          label: 'Heading',
          type: 'heading',
          bindings: {},
          rootId: '62f70064f2882d5ee31dcf71',
          parentId: '62f70064f2882d5ee31dcf71',
          styleSelectors: {
            base: ''
          }
        }
      }
    });

    expect(instance.addElement(element3, '62f89157c38ce9ef02b7a5a6', 'bottom')).toBe(true);
    expect(instance.addElement(element3, '62f89157c38ce9ef02b7a5a6', 'bottom')).toBe(false);
    expect(instance.flat).toStrictEqual({
      '62f70064f2882d5ee31dcf71': {
        id: '62f70064f2882d5ee31dcf71',
        definition: {
          label: 'Page',
          type: 'page',
          bindings: {},
          parentId: undefined,
          rootId: '62f70064f2882d5ee31dcf71',
          items: ['62f8c677a4dcde9ce010a397', '62f89157c38ce9ef02b7a5a6', '62cbd2570eedfd5fee5df93d'],
          styleSelectors: {
            base: ''
          }
        },
        attributes: {
          slug: '',
          default: true,
          name: 'Home'
        }
      },
      '62f70064f2882d5ee31dcf72': {
        id: '62f70064f2882d5ee31dcf72',
        definition: {
          label: 'Page',
          type: 'page',
          bindings: {},
          parentId: undefined,
          rootId: '62f70064f2882d5ee31dcf72',
          items: [],
          styleSelectors: {
            base: ''
          }
        },
        attributes: {
          slug: '',
          default: false,
          name: 'Page 2'
        }
      },
      '62f89157c38ce9ef02b7a5a6': {
        id: '62f89157c38ce9ef02b7a5a6',
        attributes: {
          subType: 'h1',
          content: 'Heading 1'
        },
        definition: {
          label: 'Heading',
          type: 'heading',
          bindings: {},
          rootId: '62f70064f2882d5ee31dcf71',
          parentId: '62f70064f2882d5ee31dcf71',
          styleSelectors: {
            base: ''
          }
        }
      },
      '62f8c677a4dcde9ce010a397': {
        id: '62f8c677a4dcde9ce010a397',
        attributes: {
          subType: 'h1',
          content: 'Heading 2'
        },
        definition: {
          label: 'Heading',
          type: 'heading',
          bindings: {},
          rootId: '62f70064f2882d5ee31dcf71',
          parentId: '62f70064f2882d5ee31dcf71',
          styleSelectors: {
            base: ''
          }
        }
      },
      '62cbd2570eedfd5fee5df93d': {
        id: '62cbd2570eedfd5fee5df93d',
        attributes: {},
        definition: {
          label: 'Button',
          type: 'button',
          bindings: {},
          rootId: '62f70064f2882d5ee31dcf71',
          parentId: '62f70064f2882d5ee31dcf71',
          styleSelectors: {
            base: ''
          }
        }
      }
    });
  });

  // it('FlatMap AddElement With Variables', )

  it('FlatMap Add Element Wrong', () => {
    const instance = new FlatMap({ flat: cloneDeep(flat) });
    expect(instance instanceof FlatMap).toBe(true);
    expect(instance.addElement(element1, '62f70064f2882d5ee31dcf71', 'wrong' as DropPosition)).toBe(false);
    expect(instance.addElement(element1, 'wrongId', 'inside')).toBe(false);
    expect(instance.addElement(element1, 'wrongId', 'wrong' as DropPosition)).toBe(false);
    expect(instance.addElement(element2, '62f70064f2882d5ee31dcf71', 'inside')).toBe(true);
    expect(instance.addElement(element3, '62f89157c38ce9ef02b7a5a6', 'wrong' as DropPosition)).toBe(false);
  });

  it('FlatMap Remove Element', () => {
    const instance = new FlatMap({ flat: cloneDeep(flat) });
    expect(instance instanceof FlatMap).toBe(true);
    expect(instance.removeElement('62f89157c38ce9ef02b7a5a6')).toBe(false);
    expect(instance.flat).toStrictEqual({
      '62f70064f2882d5ee31dcf71': {
        id: '62f70064f2882d5ee31dcf71',
        definition: {
          label: 'Page',
          type: 'page',
          bindings: {},
          parentId: undefined,
          rootId: '62f70064f2882d5ee31dcf71',
          items: [],
          styleSelectors: {
            base: ''
          }
        },
        attributes: {
          slug: '',
          default: true,
          name: 'Home'
        }
      },
      '62f70064f2882d5ee31dcf72': {
        id: '62f70064f2882d5ee31dcf72',
        definition: {
          label: 'Page',
          type: 'page',
          bindings: {},
          parentId: undefined,
          rootId: '62f70064f2882d5ee31dcf72',
          items: [],
          styleSelectors: {
            base: ''
          }
        },
        attributes: {
          slug: '',
          default: false,
          name: 'Page 2'
        }
      }
    });

    instance.addElement(element1, '62f70064f2882d5ee31dcf71', 'inside');
    expect(instance.flat).toStrictEqual({
      '62f70064f2882d5ee31dcf71': {
        id: '62f70064f2882d5ee31dcf71',
        definition: {
          label: 'Page',
          type: 'page',
          bindings: {},
          parentId: undefined,
          rootId: '62f70064f2882d5ee31dcf71',
          items: ['62f89157c38ce9ef02b7a5a6'],
          styleSelectors: {
            base: ''
          }
        },
        attributes: {
          slug: '',
          default: true,
          name: 'Home'
        }
      },
      '62f70064f2882d5ee31dcf72': {
        id: '62f70064f2882d5ee31dcf72',
        definition: {
          label: 'Page',
          type: 'page',
          bindings: {},
          parentId: undefined,
          rootId: '62f70064f2882d5ee31dcf72',
          items: [],
          styleSelectors: {
            base: ''
          }
        },
        attributes: {
          slug: '',
          default: false,
          name: 'Page 2'
        }
      },
      '62f89157c38ce9ef02b7a5a6': {
        id: '62f89157c38ce9ef02b7a5a6',
        attributes: {
          subType: 'h1',
          content: 'Heading 1'
        },
        definition: {
          label: 'Heading',
          type: 'heading',
          bindings: {},
          rootId: '62f70064f2882d5ee31dcf71',
          parentId: '62f70064f2882d5ee31dcf71',
          styleSelectors: {
            base: ''
          }
        }
      }
    });

    expect(instance.removeElement('62f89157c38ce9ef02b7a5a6')).toBe(true);
    expect(instance.flat).toStrictEqual({
      '62f70064f2882d5ee31dcf71': {
        id: '62f70064f2882d5ee31dcf71',
        definition: {
          label: 'Page',
          type: 'page',
          bindings: {},
          parentId: undefined,
          rootId: '62f70064f2882d5ee31dcf71',
          items: [],
          styleSelectors: {
            base: ''
          }
        },
        attributes: {
          slug: '',
          default: true,
          name: 'Home'
        }
      },
      '62f70064f2882d5ee31dcf72': {
        id: '62f70064f2882d5ee31dcf72',
        definition: {
          label: 'Page',
          type: 'page',
          bindings: {},
          parentId: undefined,
          rootId: '62f70064f2882d5ee31dcf72',
          items: [],
          styleSelectors: {
            base: ''
          }
        },
        attributes: {
          slug: '',
          default: false,
          name: 'Page 2'
        }
      }
    });
  });

  it('FlatMap Remove Element Page', () => {
    const instance = new FlatMap({ flat: cloneDeep(flat) });
    expect(instance instanceof FlatMap).toBe(true);
    // Should remove normal page
    expect(instance.removeElement('62f70064f2882d5ee31dcf72', true)).toBe(true);
    expect(instance.flat).toStrictEqual({
      '62f70064f2882d5ee31dcf71': {
        id: '62f70064f2882d5ee31dcf71',
        definition: {
          label: 'Page',
          type: 'page',
          bindings: {},
          parentId: undefined,
          rootId: '62f70064f2882d5ee31dcf71',
          items: [],
          styleSelectors: {
            base: ''
          }
        },
        attributes: {
          slug: '',
          default: true,
          name: 'Home'
        }
      }
    });

    // Should not remove default page
    expect(instance.removeElement('62f70064f2882d5ee31dcf71', true)).toBe(false);
    expect(instance.flat).toStrictEqual({
      '62f70064f2882d5ee31dcf71': {
        id: '62f70064f2882d5ee31dcf71',
        definition: {
          label: 'Page',
          type: 'page',
          bindings: {},
          parentId: undefined,
          rootId: '62f70064f2882d5ee31dcf71',
          items: [],
          styleSelectors: {
            base: ''
          }
        },
        attributes: {
          slug: '',
          default: true,
          name: 'Home'
        }
      }
    });
  });

  it('FlatMap Remove Element Wrong', () => {
    const instance = new FlatMap({ flat: cloneDeep(flat) });
    expect(instance instanceof FlatMap).toBe(true);
    expect(instance.removeElement('wrongId')).toBe(false);
    expect(instance.removeElement('62f70064f2882d5ee31dcf71')).toBe(false);
  });

  it('FlatMap Update Element', () => {
    const instance = new FlatMap({ flat: cloneDeep(flat) });
    expect(instance instanceof FlatMap).toBe(true);
    expect(instance.addElement(element1, '62f70064f2882d5ee31dcf71', 'inside')).toBe(true);
    expect(
      instance.updateElement({ ...element1, attributes: { ...element1.attributes, content: 'Hello World' } })
    ).toBe(true);
    expect(instance.flat).toStrictEqual({
      '62f70064f2882d5ee31dcf71': {
        id: '62f70064f2882d5ee31dcf71',
        definition: {
          label: 'Page',
          type: 'page',
          bindings: {},
          parentId: undefined,
          rootId: '62f70064f2882d5ee31dcf71',
          items: ['62f89157c38ce9ef02b7a5a6'],
          styleSelectors: {
            base: ''
          }
        },
        attributes: {
          slug: '',
          default: true,
          name: 'Home'
        }
      },
      '62f70064f2882d5ee31dcf72': {
        id: '62f70064f2882d5ee31dcf72',
        definition: {
          label: 'Page',
          type: 'page',
          bindings: {},
          parentId: undefined,
          rootId: '62f70064f2882d5ee31dcf72',
          items: [],
          styleSelectors: {
            base: ''
          }
        },
        attributes: {
          slug: '',
          default: false,
          name: 'Page 2'
        }
      },
      '62f89157c38ce9ef02b7a5a6': {
        id: '62f89157c38ce9ef02b7a5a6',
        attributes: {
          subType: 'h1',
          content: 'Hello World'
        },
        definition: {
          label: 'Heading',
          type: 'heading',
          bindings: {},
          rootId: '62f70064f2882d5ee31dcf71',
          parentId: '62f70064f2882d5ee31dcf71',
          styleSelectors: {
            base: ''
          }
        }
      }
    });
  });

  it('FlatMap Update Element idRef', () => {
    const instance = new FlatMap({ flat: cloneDeep(flat) });
    expect(instance.addElement({ ...element1, idRef: 'hero' }, '62f70064f2882d5ee31dcf71', 'inside')).toBe(true);
    expect(instance.updateElement({ ...element1, idRef: 'hero-2' })).toBe(true);
    expect(instance.flat[element1.id].idRef).toBe('hero-2');
  });

  it('FlatMap Update Element idRef Repoints The Wiring', () => {
    const instance = new FlatMap({ flat: cloneDeep(flat) });
    expect(instance.addElement({ ...element1, idRef: 'hero' }, '62f70064f2882d5ee31dcf71', 'inside')).toBe(true);
    // A sibling wired to the renamed element: a binding reading its source, and an interaction targeting it.
    instance.flat['62f70064f2882d5ee31dcf72'].definition.bindings = {
      attributes: [{ id: 'b1', source: 'heading_hero.content', to: 'content' }]
    };
    instance.flat['62f70064f2882d5ee31dcf72'].definition.interactions = {
      n1: {
        id: 'n1',
        title: 'Hide',
        type: 'callback',
        action: 'setVisibility',
        elementId: 'hero',
        params: {},
        preview: {},
        beforeNode: '',
        afterNode: '',
        flowId: 'n0',
        enabled: true
      }
    };

    expect(instance.updateElement({ ...element1, idRef: 'hero-2' })).toBe(true);

    const sibling = instance.flat['62f70064f2882d5ee31dcf72'].definition;
    expect(sibling.bindings?.attributes?.[0].source).toBe('heading_hero-2.content');
    expect(sibling.interactions?.n1.elementId).toBe('hero-2');
  });

  it('FlatMap Update Element idRef Taken', () => {
    const instance = new FlatMap({ flat: cloneDeep(flat) });
    instance.flat['62f70064f2882d5ee31dcf72'].idRef = 'landing';
    expect(instance.addElement({ ...element1, idRef: 'hero' }, '62f70064f2882d5ee31dcf71', 'inside')).toBe(true);
    expect(instance.updateElement({ ...element1, idRef: 'landing' })).toBe(false);
    expect(instance.flat[element1.id].idRef).toBe('hero');
  });

  it('FlatMap Update Element idRef Malformed', () => {
    const instance = new FlatMap({ flat: cloneDeep(flat) });
    expect(instance.addElement({ ...element1, idRef: 'hero' }, '62f70064f2882d5ee31dcf71', 'inside')).toBe(true);
    expect(instance.updateElement({ ...element1, idRef: 'hero.cta' })).toBe(false);
    expect(instance.flat[element1.id].idRef).toBe('hero');
  });

  it('FlatMap Add Element idRef Taken', () => {
    const instance = new FlatMap({ flat: cloneDeep(flat) });
    instance.flat['62f70064f2882d5ee31dcf72'].idRef = 'landing';
    expect(instance.addElement({ ...element1, idRef: 'landing' }, '62f70064f2882d5ee31dcf71', 'inside')).toBe(false);
    expect(instance.flat[element1.id]).toBeUndefined();
    expect(instance.flat['62f70064f2882d5ee31dcf71'].definition.items).toStrictEqual([]);
  });

  it('FlatMap Add Element idRef Repeated In The Incoming Set', () => {
    const instance = new FlatMap({ flat: cloneDeep(flat) });
    const child = { ...element1, id: '62f89157c38ce9ef02b7a5a7', idRef: 'hero' };
    expect(
      instance.addElement({ ...element1, idRef: 'hero' }, '62f70064f2882d5ee31dcf71', 'inside', { [child.id]: child })
    ).toBe(false);
    expect(instance.flat[child.id]).toBeUndefined();
  });

  it('FlatMap Update Element idRef Unchanged', () => {
    const instance = new FlatMap({ flat: cloneDeep(flat) });
    expect(instance.addElement({ ...element1, idRef: 'hero' }, '62f70064f2882d5ee31dcf71', 'inside')).toBe(true);
    expect(
      instance.updateElement({ ...element1, idRef: 'hero', attributes: { ...element1.attributes, content: 'Hi' } })
    ).toBe(true);
    expect(instance.flat[element1.id].attributes.content).toBe('Hi');
  });

  it('FlatMap Update Element Wrong', () => {
    const instance = new FlatMap({ flat: cloneDeep(flat) });
    expect(instance instanceof FlatMap).toBe(true);
    expect(instance.addElement(element1, '62f70064f2882d5ee31dcf71', 'inside')).toBe(true);
    expect(instance.updateElement({ ...element1, id: 'i am wrong' })).toBe(false);
    expect(instance.flat).toStrictEqual({
      '62f70064f2882d5ee31dcf71': {
        id: '62f70064f2882d5ee31dcf71',
        definition: {
          label: 'Page',
          type: 'page',
          bindings: {},
          parentId: undefined,
          rootId: '62f70064f2882d5ee31dcf71',
          items: ['62f89157c38ce9ef02b7a5a6'],
          styleSelectors: {
            base: ''
          }
        },
        attributes: {
          slug: '',
          default: true,
          name: 'Home'
        }
      },
      '62f70064f2882d5ee31dcf72': {
        id: '62f70064f2882d5ee31dcf72',
        definition: {
          label: 'Page',
          type: 'page',
          bindings: {},
          parentId: undefined,
          rootId: '62f70064f2882d5ee31dcf72',
          items: [],
          styleSelectors: {
            base: ''
          }
        },
        attributes: {
          slug: '',
          default: false,
          name: 'Page 2'
        }
      },
      '62f89157c38ce9ef02b7a5a6': {
        id: '62f89157c38ce9ef02b7a5a6',
        attributes: {
          subType: 'h1',
          content: 'Heading 1'
        },
        definition: {
          label: 'Heading',
          type: 'heading',
          bindings: {},
          rootId: '62f70064f2882d5ee31dcf71',
          parentId: '62f70064f2882d5ee31dcf71',
          styleSelectors: {
            base: ''
          }
        }
      }
    });
  });

  // yarn test FlatMap.test.js -t flatAsTemplate
  it('flatAsTemplate', () => {
    const instance = new FlatMap({
      flat: cloneDeep(schema1.flat) as Schema['flat'],
      variables: cloneDeep(schema1.variables) as Schema['variables']
    });
    const { elements, elementsStyle, variables } = instance.flatAsTemplate(
      styleSchema1 as Style,
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
        mode: 'desktop-first',
        platform: {
          desktop: {
            'heading-rdGM': {
              attributes: {
                base: {
                  default: {
                    'background-color': 'var(--primaryColor)',
                    color: 'var(--fancyVariableColor)'
                  }
                }
              },
              cache: '.heading-rdGM{color:var(--fancyVariableColor);background-color:var(--primaryColor);}',
              name: 'heading-rdGM',
              type: 'class'
            },
            'button-rdGM': {
              name: 'button-rdGM',
              type: 'class',
              attributes: {
                base: {
                  default: {
                    color: 'var(--fancyVariableColor)',
                    'background-color': 'var(--primaryColor)'
                  }
                }
              },
              cache: '.button-rdGM{color:var(--fancyVariableColor);background-color:var(--primaryColor);}'
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

  it('flatAsTemplate - non-container element', () => {
    const instance = new FlatMap({
      flat: cloneDeep(schema1.flat) as Schema['flat'],
      variables: cloneDeep(schema1.variables) as Schema['variables']
    });
    const { elements, elementsStyle, variables } = instance.flatAsTemplate(
      styleSchema1 as Style,
      '669b33dcf636e501810d3d1d'
    );
    expect({ elements, elementsStyle, variables }).toStrictEqual({
      elements: {
        acum: {
          id_0d3d1d: {
            id: 'id_0d3d1d',
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
              rootId: 'id_0d3d1d',
              parentId: null
            }
          }
        },
        item: {
          id: 'id_0d3d1d',
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
            rootId: 'id_0d3d1d',
            parentId: null
          }
        }
      },
      elementsStyle: {
        cache: '',
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

  it('flatAsTemplate - copies global element styles (type element)', () => {
    const instance = new FlatMap({
      flat: cloneDeep(schema1.flat) as Schema['flat'],
      variables: cloneDeep(schema1.variables) as Schema['variables']
    });
    const { elementsStyle, variables } = instance.flatAsTemplate(styleSchema2 as Style, '669b33dcf636e501810d3d1d');
    expect({ elementsStyle, variables }).toStrictEqual({
      elementsStyle: {
        cache: '',
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
    const variables = instance.getElementVariables(styleSchema1 as Style, '669b33dcf636e501810d3d1d');
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
