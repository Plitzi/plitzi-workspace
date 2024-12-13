// Relatives
import List from './List.js';
import ListItem from './ListItem/index.js';

List.content = {
  attributes: {
    items: [],
    source: 'none',
    subType: 'ul'
  },
  definition: {
    label: 'List',
    type: 'list',
    description:
      'A List gives you the ability to group elements or content (like links in a navigation menu, or steps in a recipe), to add helpful structure to your site.',
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
    itemsNotAllowed: []
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
    name: 'List',
    displayMode: 'desktop',
    style: {},
    subTypes: {
      ul: {
        name: 'List UL',
        displayMode: 'desktop',
        style: {
          base: {
            'margin-top': '0px',
            'margin-bottom': '10px',
            'padding-left': '40px',
            'min-width': '50px',
            'min-height': '50px'
          }
        }
      },
      ol: {
        name: 'List OL',
        displayMode: 'desktop',
        style: {
          base: {
            'margin-top': '0px',
            'margin-bottom': '10px',
            'padding-left': '40px',
            'min-width': '50px',
            'min-height': '50px'
          }
        }
      }
    }
  },
  settings: {}
};

List.initialItems = ['listItem', 'listItem', 'listItem'];
List.plugins = { listItem: ListItem };
List.type = 'list';

export default List;
