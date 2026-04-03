import BaseImage from './Image';

const Image = Object.assign(BaseImage, {
  type: 'image',
  content: {
    attributes: {
      src: 'https://cdn.plitzi.com/resources/img/placeholder-img.svg',
      alt: '',
      fetchPriority: 'auto',
      loadMode: 'auto'
    },
    definition: {
      label: 'Image',
      type: 'image',
      description: 'Use an URL to display an image.',
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
      icon: 'fa-solid fa-image'
    },
    defaultStyle: {
      name: 'Image',
      displayMode: 'desktop',
      style: {
        base: {
          default: {
            display: 'block',
            width: '140px',
            height: '140px'
          }
        }
      }
    },
    settings: {}
  }
});

export default Image;
