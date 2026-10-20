import { cloneDeep } from '@plitzi/plitzi-ui/helpers';
import { describe, it, expect } from 'vitest';

import FlatMap from './FlatMap';
import { element1, flat } from './tests/FlatMap';

import type { DropPosition } from '@plitzi/sdk-shared';

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

describe('Testing FlatMap', () => {
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
});
