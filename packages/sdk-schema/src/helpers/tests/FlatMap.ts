export const flat = {
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

export const element1 = {
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
