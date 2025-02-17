import ListItem from './ListItem';

ListItem.content = {
  attributes: {},
  definition: {
    label: 'List Item',
    type: 'listItem',
    description:
      'The List Item element lets you add more items to existing List elements. You can then add any content you would like to them, including links, images, etc.',
    items: [],
    bindings: {},
    styleSelectors: {
      base: ''
    },
    initialState: {
      visibility: true
    }
  },
  builder: {
    canDelete: true,
    canSelect: true,
    canDragDrop: true,
    canMove: true,
    canTemplate: true,
    itemsAllowed: [],
    itemsNotAllowed: ['listItem']
  },
  market: {
    category: 'structure',
    owner: 'Plitzi',
    verified: true,
    license: 'MIT',
    website: 'https://plitzi.com',
    backgroundColor: '#4422ee',
    icon: 'fa-solid fa-list'
  },
  defaultStyle: {
    name: 'List Item',
    displayMode: 'desktop',
    style: {
      base: {
        'min-width': '50px',
        'min-height': '50px'
      }
    }
  },
  settings: {}
};

ListItem.type = 'listItem';

export default ListItem;
