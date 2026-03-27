import BaseLink from './Link';

const Link = Object.assign(BaseLink, {
  type: 'link',
  content: {
    attributes: {
      href: '#',
      target: 'self',
      mode: 'page',
      linkContext: undefined
    },
    definition: {
      label: 'Link',
      type: 'link',
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
      itemsNotAllowed: ['link']
    },
    market: {
      category: 'basic',
      owner: 'Plitzi',
      verified: true,
      license: 'MIT',
      website: 'https://plitzi.com',
      backgroundColor: '#4422ee',
      icon: 'fa-solid fa-link'
    },
    defaultStyle: {
      name: 'Link',
      displayMode: 'desktop',
      style: {
        base: {
          default: {
            display: 'inline-block',
            'min-height': '30px',
            'min-width': '30px',
            color: '#333',
            cursor: 'pointer'
          }
        }
      }
    },
    settings: {}
  }
});

export default Link;
