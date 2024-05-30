// Relatives
import TabContainer from './TabContainer';
import TabContainerItem from './TabContainerItem';
import TabContainerBody from './TabContainerBody';
import TabContainerHeader from './TabContainerHeader';

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
    icon: 'https://cdn.plitzi.com/resources/img/favicon.svg'
  },
  bindingsAllowed: {
    attributes: [],
    style: [
      { path: 'color', label: 'Color' },
      { path: 'background-color', label: 'Background Color' }
    ],
    initialState: [
      { path: 'visibility', label: 'Visibility' },
      { path: 'styleSelectors.base', label: 'Selector - Base' }
    ]
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
