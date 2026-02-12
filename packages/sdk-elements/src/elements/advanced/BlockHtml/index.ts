import BaseBlockHtml from './BlockHtml';

const BlockHtml = Object.assign(BaseBlockHtml, {
  type: 'blockHtml',
  content: {
    attributes: {
      content: ''
    },
    definition: {
      label: 'HTML Block',
      type: 'blockHtml',
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
      category: 'advanced',
      owner: 'Plitzi',
      verified: true,
      license: 'MIT',
      website: 'https://plitzi.com',
      backgroundColor: '#4422ee',
      icon: 'fa-brands fa-html5'
    },
    defaultStyle: {
      name: 'HTML Block',
      displayMode: 'desktop',
      style: {}
    },
    settings: {}
  }
});

export default BlockHtml;
