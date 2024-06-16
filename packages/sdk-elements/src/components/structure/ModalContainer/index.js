// Relatives
import ModalContainer from './ModalContainer';

ModalContainer.content = {
  attributes: {
    title: 'Modal Header',
    autoHideAfterClick: true
  },
  definition: {
    label: 'Modal Container',
    type: 'modalContainer',
    description: '',
    items: [],
    bindings: {},
    styleSelectors: {
      base: '',
      backgroundContainer: '',
      rootContainer: '',
      headerContainer: '',
      headerTitle: '',
      bodyContainer: ''
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
    icon: 'https://cdn.plitzi.com/resources/img/favicon.svg'
  },
  bindingsAllowed: {
    attributes: [],
    initialState: [
      { path: 'visibility', label: 'Visibility' },
      { path: 'styleSelectors.base', label: 'Selector - Base' },
      { path: 'styleSelectors.backgroundContainer', label: 'Selector - Background Container' },
      { path: 'styleSelectors.rootContainer', label: 'Selector - Root Container' },
      { path: 'styleSelectors.headerContainer', label: 'Selector - Header Container' },
      { path: 'styleSelectors.headerTitle', label: 'Selector - Header Title' },
      { path: 'styleSelectors.bodyContainer', label: 'Selector - Body Container' }
    ]
  },
  defaultStyle: {
    name: 'Modal Container',
    displayMode: 'desktop',
    style: {
      base: {
        position: 'absolute',
        top: '0',
        bottom: '0',
        left: '0',
        right: '0'
      },
      backgroundContainer: {
        height: '100%',
        width: '100%',
        left: '0',
        top: '0',
        position: 'absolute',
        'background-color': 'black',
        opacity: '0.5'
      },
      rootContainer: {
        display: 'flex',
        'flex-direction': 'column',
        position: 'absolute',
        top: '50%',
        left: '50%',
        width: '500px',
        height: '300px',
        'background-color': 'white',
        transform: 'translate3d(-50%, -50%, 0px)',
        'border-top-left-radius': '8px',
        'border-top-right-radius': '8px',
        'border-bottom-left-radius': '8px',
        'border-bottom-right-radius': '8px'
      },
      headerContainer: {
        display: 'flex',
        'align-items': 'center',
        'justify-content': 'space-between',
        'border-bottom-width': '1px',
        'border-bottom-color': '#d1d5db',
        'border-bottom-style': 'solid',
        'padding-left': '20px',
        'padding-right': '20px',
        'padding-top': '10px',
        'padding-bottom': '10px'
      },
      headerTitle: {
        'font-size': '20px',
        'font-weight': '500',
        'line-height': '1.2',
        color: '#333'
      },
      bodyContainer: {
        display: 'flex',
        'flex-direction': 'column',
        'flex-grow': '1',
        'flex-basis': '0',
        'padding-top': '20px',
        'padding-bottom': '20px',
        'padding-left': '20px',
        'padding-right': '20px'
      }
    },
    subTypes: {}
  },
  settings: {}
};

ModalContainer.initialItems = ['container'];
ModalContainer.type = 'modalContainer';

export default ModalContainer;
