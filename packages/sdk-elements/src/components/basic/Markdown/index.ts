import BaseMarkdown from './Markdown';

const Markdown = Object.assign(BaseMarkdown, {
  type: 'markdown',
  content: {
    attributes: {
      content: 'Markdown'
    },
    definition: {
      label: 'Markdown',
      type: 'markdown',
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
      icon: 'fa-brands fa-markdown'
    },
    defaultStyle: {
      name: 'Markdown',
      displayMode: 'desktop',
      style: {
        base: {
          'font-size': '14px', // browser default
          'line-height': '24px' // browser default
        }
      }
    },
    settings: {}
  }
});

export default Markdown;
