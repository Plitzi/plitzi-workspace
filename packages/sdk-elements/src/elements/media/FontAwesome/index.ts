import BaseFontAwesome from './FontAwesome';

const FontAwesome = Object.assign(BaseFontAwesome, {
  type: 'fontAwesome',
  content: {
    attributes: {
      icon: 'fas fa-flag',
      size: 'fa-1x',
      iconAnimation: ''
    },
    definition: {
      label: 'Font Awesome',
      type: 'fontAwesome',
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
      category: 'media',
      owner: 'Plitzi',
      verified: true,
      license: 'MIT',
      website: 'https://plitzi.com',
      backgroundColor: '#4422ee',
      icon: 'fa-solid fa-font-awesome'
    },
    defaultStyle: {
      name: 'Font Awesome',
      displayMode: 'desktop',
      style: {
        base: {
          default: {
            display: 'inline-block',
            'font-size': '16px'
          }
        }
      }
    },
    settings: {}
  }
});

export default FontAwesome;
