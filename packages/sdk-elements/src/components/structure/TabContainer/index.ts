import TabContainer from './TabContainer';
import TabContainerItem from './TabContainerItem/index';
import TabContainerBody from './TabContainerBody/index';
import TabContainerHeader from './TabContainerHeader/index';

TabContainer.content = {
  attributes: {},
  definition: {
    label: 'Tab Container',
    type: 'tabContainer',
    description: 'Group things together into groups, also nestable.',
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
    itemsAllowed: ['tabContainerHeader', 'tabContainerBody'],
    itemsNotAllowed: []
  },
  market: {
    category: 'structure',
    owner: 'Plitzi',
    verified: true,
    license: 'MIT',
    website: 'https://plitzi.com',
    backgroundColor: '#4422ee',
    icon: 'fa-solid fa-table-columns'
  },
  defaultStyle: {
    name: 'Tab Container',
    displayMode: 'desktop',
    style: {},
    subTypes: {}
  },
  settings: {}
};

TabContainer.initialItems = ['tabContainerHeader', 'tabContainerBody'];
TabContainer.plugins = {
  tabContainerHeader: TabContainerHeader,
  tabContainerBody: TabContainerBody,
  tabContainerItem: TabContainerItem
};
TabContainer.type = 'tabContainer';

export default TabContainer;
