import BaseText from './Text';

const Text = Object.assign(BaseText, {
  type: 'text',
  content: {
    attributes: {
      content: 'Text'
    },
    definition: {
      label: 'Text',
      type: 'text',
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
      category: 'basic',
      owner: 'Plitzi',
      verified: true,
      license: 'MIT',
      website: 'https://plitzi.com',
      backgroundColor: '#4422ee',
      icon: 'fa-solid fa-align-left'
    },
    defaultStyle: {
      name: 'Text',
      displayMode: 'desktop',
      style: {
        base: {
          default: {
            'font-size': '14px',
            'line-height': '24px',
            display: 'inline'
          }
        }
      }
    },
    settings: {}
  }
});

export default Text;
