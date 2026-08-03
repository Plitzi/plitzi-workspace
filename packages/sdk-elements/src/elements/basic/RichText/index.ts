import BaseRichText from './RichText';

const RichText = Object.assign(BaseRichText, {
  type: 'richText',
  content: {
    attributes: {
      content: '',
      format: 'html',
      mediaBaseUrl: ''
    },
    definition: {
      label: 'Rich Text',
      type: 'richText',
      description:
        'Renders a body field coming from a CMS — HTML, markdown or plain text. Scripts and event handlers are stripped before rendering, so third-party content cannot execute.',
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
      category: 'basic',
      owner: 'Plitzi',
      verified: true,
      license: 'MIT',
      website: 'https://plitzi.com',
      backgroundColor: '#4422ee',
      icon: 'fa-solid fa-align-left'
    },
    defaultStyle: {
      name: 'Rich Text',
      displayMode: 'desktop',
      style: {
        base: {
          default: {
            'min-width': '50px',
            'min-height': '50px'
          }
        }
      },
      subTypes: {}
    },
    settings: {}
  }
});

export default RichText;
