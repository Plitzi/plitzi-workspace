// Relatives
import Video from './Video';

Video.content = {
  attributes: {
    src: '',
    autoPlay: false,
    playsInline: false,
    loop: false,
    muted: true
  },
  definition: {
    label: 'Video',
    type: 'video',
    description: 'Use an URL to display a video.',
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
    icon: 'https://cdn.plitzi.com/resources/img/favicon.svg'
  },
  bindingsAllowed: {
    attributes: [{ path: 'src', label: 'Source' }],
    initialState: [
      { path: 'visibility', label: 'Visibility' },
      { path: 'styleSelectors.base', label: 'Selector - Base' }
    ]
  },
  defaultStyle: {
    name: 'Video',
    displayMode: 'desktop',
    style: {
      base: {
        width: '400px',
        height: '250px'
      }
    }
  },
  settings: {}
};

Video.type = 'video';

export default Video;
