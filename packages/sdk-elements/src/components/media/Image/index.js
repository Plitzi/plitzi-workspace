// Relatives
import Image from './Image.js';

Image.content = {
  attributes: {
    src: 'https://cdn.plitzi.com/resources/img/placeholder-img.svg',
    alt: '',
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
        width: '140px',
        height: '140px'
      }
    }
  },
  settings: {}
};

Image.type = 'image';

export default Image;
