import { cloneDeep } from '@plitzi/plitzi-ui/helpers';
import { describe, it, expect } from 'vitest';

import { positionalElementId } from './elementId';
import FlatMap from './FlatMap';
import schema1 from '../tests/fixtures/json/schema1.json';
import styleSchema1 from '../tests/fixtures/json/styleSchema1.json';
import styleSchema2 from '../tests/fixtures/json/styleSchema2.json';

import type { DropPosition, Schema, Style } from '@plitzi/sdk-shared';

describe('Testing FlatMap', () => {
  const flat = {
    home: {
      id: 'home',
      definition: {
        label: 'Page',
        type: 'page',
        bindings: {},
        parentId: undefined,
        rootId: 'home',
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
    about: {
      id: 'about',
      definition: {
        label: 'Page',
        type: 'page',
        bindings: {},
        parentId: undefined,
        rootId: 'about',
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
    id: 'heading-1',
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
    id: 'heading-2',
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
    id: 'button-1',
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
    expect(instance.addElement(element1, 'home', 'inside')).toBe(true);
    expect(instance.flat).toStrictEqual({
      home: {
        id: 'home',
        definition: {
          label: 'Page',
          type: 'page',
          bindings: {},
          parentId: undefined,
          rootId: 'home',
          items: ['heading-1'],
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
      about: {
        id: 'about',
        definition: {
          label: 'Page',
          type: 'page',
          bindings: {},
          parentId: undefined,
          rootId: 'about',
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
      'heading-1': {
        id: 'heading-1',
        attributes: {
          subType: 'h1',
          content: 'Heading 1'
        },
        definition: {
          label: 'Heading',
          type: 'heading',
          bindings: {},
          rootId: 'home',
          parentId: 'home',
          styleSelectors: {
            base: ''
          }
        }
      }
    });

    expect(instance.addElement(element2, 'heading-1', 'top')).toBe(true);
    expect(instance.flat).toStrictEqual({
      home: {
        id: 'home',
        definition: {
          label: 'Page',
          type: 'page',
          bindings: {},
          parentId: undefined,
          rootId: 'home',
          items: ['heading-2', 'heading-1'],
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
      about: {
        id: 'about',
        definition: {
          label: 'Page',
          type: 'page',
          bindings: {},
          parentId: undefined,
          rootId: 'about',
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
      'heading-1': {
        id: 'heading-1',
        attributes: {
          subType: 'h1',
          content: 'Heading 1'
        },
        definition: {
          label: 'Heading',
          type: 'heading',
          bindings: {},
          rootId: 'home',
          parentId: 'home',
          styleSelectors: {
            base: ''
          }
        }
      },
      'heading-2': {
        id: 'heading-2',
        attributes: {
          subType: 'h1',
          content: 'Heading 2'
        },
        definition: {
          label: 'Heading',
          type: 'heading',
          bindings: {},
          rootId: 'home',
          parentId: 'home',
          styleSelectors: {
            base: ''
          }
        }
      }
    });

    expect(instance.addElement(element3, 'heading-1', 'bottom')).toBe(true);
    expect(instance.addElement(element3, 'heading-1', 'bottom')).toBe(false);
    expect(instance.flat).toStrictEqual({
      home: {
        id: 'home',
        definition: {
          label: 'Page',
          type: 'page',
          bindings: {},
          parentId: undefined,
          rootId: 'home',
          items: ['heading-2', 'heading-1', 'button-1'],
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
      about: {
        id: 'about',
        definition: {
          label: 'Page',
          type: 'page',
          bindings: {},
          parentId: undefined,
          rootId: 'about',
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
      'heading-1': {
        id: 'heading-1',
        attributes: {
          subType: 'h1',
          content: 'Heading 1'
        },
        definition: {
          label: 'Heading',
          type: 'heading',
          bindings: {},
          rootId: 'home',
          parentId: 'home',
          styleSelectors: {
            base: ''
          }
        }
      },
      'heading-2': {
        id: 'heading-2',
        attributes: {
          subType: 'h1',
          content: 'Heading 2'
        },
        definition: {
          label: 'Heading',
          type: 'heading',
          bindings: {},
          rootId: 'home',
          parentId: 'home',
          styleSelectors: {
            base: ''
          }
        }
      },
      'button-1': {
        id: 'button-1',
        attributes: {},
        definition: {
          label: 'Button',
          type: 'button',
          bindings: {},
          rootId: 'home',
          parentId: 'home',
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
    expect(instance.addElement(element1, 'home', 'wrong' as DropPosition)).toBe(false);
    expect(instance.addElement(element1, 'wrongId', 'inside')).toBe(false);
    expect(instance.addElement(element1, 'wrongId', 'wrong' as DropPosition)).toBe(false);
    expect(instance.addElement(element2, 'home', 'inside')).toBe(true);
    expect(instance.addElement(element3, 'heading-1', 'wrong' as DropPosition)).toBe(false);
  });

  it('FlatMap Remove Element', () => {
    const instance = new FlatMap({ flat: cloneDeep(flat) });
    expect(instance instanceof FlatMap).toBe(true);
    expect(instance.removeElement('heading-1')).toBe(false);
    expect(instance.flat).toStrictEqual({
      home: {
        id: 'home',
        definition: {
          label: 'Page',
          type: 'page',
          bindings: {},
          parentId: undefined,
          rootId: 'home',
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
      about: {
        id: 'about',
        definition: {
          label: 'Page',
          type: 'page',
          bindings: {},
          parentId: undefined,
          rootId: 'about',
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

    instance.addElement(element1, 'home', 'inside');
    expect(instance.flat).toStrictEqual({
      home: {
        id: 'home',
        definition: {
          label: 'Page',
          type: 'page',
          bindings: {},
          parentId: undefined,
          rootId: 'home',
          items: ['heading-1'],
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
      about: {
        id: 'about',
        definition: {
          label: 'Page',
          type: 'page',
          bindings: {},
          parentId: undefined,
          rootId: 'about',
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
      'heading-1': {
        id: 'heading-1',
        attributes: {
          subType: 'h1',
          content: 'Heading 1'
        },
        definition: {
          label: 'Heading',
          type: 'heading',
          bindings: {},
          rootId: 'home',
          parentId: 'home',
          styleSelectors: {
            base: ''
          }
        }
      }
    });

    expect(instance.removeElement('heading-1')).toBe(true);
    expect(instance.flat).toStrictEqual({
      home: {
        id: 'home',
        definition: {
          label: 'Page',
          type: 'page',
          bindings: {},
          parentId: undefined,
          rootId: 'home',
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
      about: {
        id: 'about',
        definition: {
          label: 'Page',
          type: 'page',
          bindings: {},
          parentId: undefined,
          rootId: 'about',
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
    expect(instance.removeElement('about', true)).toBe(true);
    expect(instance.flat).toStrictEqual({
      home: {
        id: 'home',
        definition: {
          label: 'Page',
          type: 'page',
          bindings: {},
          parentId: undefined,
          rootId: 'home',
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
    expect(instance.removeElement('home', true)).toBe(false);
    expect(instance.flat).toStrictEqual({
      home: {
        id: 'home',
        definition: {
          label: 'Page',
          type: 'page',
          bindings: {},
          parentId: undefined,
          rootId: 'home',
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
    expect(instance.removeElement('home')).toBe(false);
  });

  it('FlatMap Update Element', () => {
    const instance = new FlatMap({ flat: cloneDeep(flat) });
    expect(instance instanceof FlatMap).toBe(true);
    expect(instance.addElement(element1, 'home', 'inside')).toBe(true);
    expect(
      instance.updateElement({ ...element1, attributes: { ...element1.attributes, content: 'Hello World' } })
    ).toBe(true);
    expect(instance.flat).toStrictEqual({
      home: {
        id: 'home',
        definition: {
          label: 'Page',
          type: 'page',
          bindings: {},
          parentId: undefined,
          rootId: 'home',
          items: ['heading-1'],
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
      about: {
        id: 'about',
        definition: {
          label: 'Page',
          type: 'page',
          bindings: {},
          parentId: undefined,
          rootId: 'about',
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
      'heading-1': {
        id: 'heading-1',
        attributes: {
          subType: 'h1',
          content: 'Hello World'
        },
        definition: {
          label: 'Heading',
          type: 'heading',
          bindings: {},
          rootId: 'home',
          parentId: 'home',
          styleSelectors: {
            base: ''
          }
        }
      }
    });
  });

  it('FlatMap Rename Element', () => {
    const instance = new FlatMap({ flat: cloneDeep(flat) });
    expect(instance.addElement({ ...element1, id: 'hero' }, 'home', 'inside')).toBe(true);
    // The parent lists the renamed child in its items, so it moved too — which is exactly what a
    // broadcast has to publish.
    expect([...(instance.renameElement('hero', 'banner') as string[])].sort()).toStrictEqual(['banner', 'home']);
    expect(instance.flat.hero).toBeUndefined();
    expect(instance.flat.banner.id).toBe('banner');
    expect(instance.flat.home.definition.items).toStrictEqual(['banner']);
  });

  it('FlatMap Rename Element Repoints The Wiring', () => {
    const instance = new FlatMap({ flat: cloneDeep(flat) });
    expect(instance.addElement({ ...element1, id: 'hero' }, 'home', 'inside')).toBe(true);
    // A sibling wired to the renamed element: a binding reading its source, and an interaction targeting it.
    instance.flat.about.definition.bindings = {
      attributes: [{ id: 'b1', source: 'heading_hero.content', to: 'content' }]
    };
    instance.flat.about.definition.interactions = {
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

    expect([...(instance.renameElement('hero', 'banner') as string[])].sort()).toStrictEqual([
      'about',
      'banner',
      'home'
    ]);

    const sibling = instance.flat.about.definition;
    expect(sibling.bindings?.attributes?.[0].source).toBe('heading_banner.content');
    expect(sibling.interactions?.n1.elementId).toBe('banner');
  });

  it('FlatMap Rename Element Taken', () => {
    const instance = new FlatMap({ flat: cloneDeep(flat) });
    expect(instance.addElement({ ...element1, id: 'hero' }, 'home', 'inside')).toBe(true);
    expect(instance.renameElement('hero', 'about')).toBe(false);
    expect(instance.flat.hero.id).toBe('hero');
  });

  it('FlatMap Rename Element Malformed', () => {
    const instance = new FlatMap({ flat: cloneDeep(flat) });
    expect(instance.addElement({ ...element1, id: 'hero' }, 'home', 'inside')).toBe(true);
    expect(instance.renameElement('hero', 'hero.cta')).toBe(false);
    expect(instance.flat.hero.id).toBe('hero');
  });

  it('FlatMap Rename Element Unknown', () => {
    const instance = new FlatMap({ flat: cloneDeep(flat) });
    expect(instance.renameElement('nobody', 'hero')).toBe(false);
  });

  it('FlatMap Add Element Id Taken', () => {
    const instance = new FlatMap({ flat: cloneDeep(flat) });
    expect(instance.addElement({ ...element1, id: 'about' }, 'home', 'inside')).toBe(false);
    expect(instance.flat.home.definition.items).toStrictEqual([]);
  });

  it('FlatMap Add Element Id Repeated In The Incoming Set', () => {
    const instance = new FlatMap({ flat: cloneDeep(flat) });
    const child = { ...element1, id: 'hero' };
    expect(instance.addElement({ ...element1, id: 'hero' }, 'home', 'inside', { [child.id]: child })).toBe(false);
    expect(instance.flat.hero).toBeUndefined();
  });

  it('FlatMap Add Element Mints A Name When The Caller Gives None', () => {
    const instance = new FlatMap({ flat: cloneDeep(flat), mintId: positionalElementId });
    expect(
      instance.addElement({ attributes: element1.attributes, definition: element1.definition }, 'home', 'inside')
    ).toBe(true);
    expect(instance.flat['heading-1'].definition.type).toBe('heading');
    expect(instance.flat.home.definition.items).toStrictEqual(['heading-1']);
  });

  it('FlatMap Update Element Keeps The Name Out Of An Update', () => {
    const instance = new FlatMap({ flat: cloneDeep(flat) });
    expect(instance.addElement({ ...element1, id: 'hero' }, 'home', 'inside')).toBe(true);
    expect(
      instance.updateElement({ ...element1, id: 'hero', attributes: { ...element1.attributes, content: 'Hi' } })
    ).toBe(true);
    expect(instance.flat.hero.attributes.content).toBe('Hi');
  });

  it('FlatMap Update Element Wrong', () => {
    const instance = new FlatMap({ flat: cloneDeep(flat) });
    expect(instance instanceof FlatMap).toBe(true);
    expect(instance.addElement(element1, 'home', 'inside')).toBe(true);
    expect(instance.updateElement({ ...element1, id: 'i am wrong' })).toBe(false);
    expect(instance.flat).toStrictEqual({
      home: {
        id: 'home',
        definition: {
          label: 'Page',
          type: 'page',
          bindings: {},
          parentId: undefined,
          rootId: 'home',
          items: ['heading-1'],
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
      about: {
        id: 'about',
        definition: {
          label: 'Page',
          type: 'page',
          bindings: {},
          parentId: undefined,
          rootId: 'about',
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
      'heading-1': {
        id: 'heading-1',
        attributes: {
          subType: 'h1',
          content: 'Heading 1'
        },
        definition: {
          label: 'Heading',
          type: 'heading',
          bindings: {},
          rootId: 'home',
          parentId: 'home',
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
    const { elements, elementsStyle, variables } = instance.flatAsTemplate(styleSchema1 as Style, 'wrapper');
    expect({ elements, elementsStyle, variables }).toStrictEqual({
      elements: {
        acum: {
          'title-2': {
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
              parentId: 'wrapper-2',
              rootId: 'wrapper-2',
              styleSelectors: {
                base: 'heading-rdGM'
              },
              type: 'heading'
            },
            id: 'title-2'
          },
          'wrapper-2': {
            attributes: {
              subType: 'div'
            },
            definition: {
              bindings: {},
              description: 'Group things together into groups, also nestable.',
              initialState: {
                visibility: true
              },
              items: ['cta-2', 'title-2'],
              label: 'Container',
              parentId: null,
              rootId: 'wrapper-2',
              styleSelectors: {
                base: ''
              },
              type: 'container'
            },
            id: 'wrapper-2'
          },
          'cta-2': {
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
                'openModal-1': {
                  action: 'onClick',
                  afterNode: 'trackClick-1',
                  beforeNode: '',
                  elementId: 'cta-2',
                  enabled: true,
                  flowId: 'openModal-1',
                  id: 'openModal-1',
                  params: {
                    propagateEvent: false
                  },
                  preview: {
                    propagateEvent: ''
                  },
                  title: 'New Trigger',
                  type: 'trigger'
                },
                'trackClick-1': {
                  action: 'setState',
                  afterNode: '',
                  beforeNode: 'openModal-1',
                  elementId: 'title-2',
                  enabled: true,
                  flowId: 'openModal-1',
                  id: 'trackClick-1',
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
              parentId: 'wrapper-2',
              rootId: 'wrapper-2',
              styleSelectors: {
                base: 'button-rdGM'
              },
              type: 'button'
            },
            id: 'cta-2'
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
            items: ['cta-2', 'title-2'],
            label: 'Container',
            parentId: null,
            rootId: 'wrapper-2',
            styleSelectors: {
              base: ''
            },
            type: 'container'
          },
          id: 'wrapper-2'
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
    const { elements, elementsStyle, variables } = instance.flatAsTemplate(styleSchema1 as Style, 'title');
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
              rootId: 'title-2',
              parentId: null
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
            rootId: 'title-2',
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
    const { elementsStyle, variables } = instance.flatAsTemplate(styleSchema2 as Style, 'title');
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
