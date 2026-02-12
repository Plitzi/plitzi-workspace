import BaseVideo from './Video';

const Video = Object.assign(BaseVideo, {
  type: 'video',
  content: {
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
      icon: 'fa-solid fa-video'
    },
    defaultStyle: {
      name: 'Video',
      displayMode: 'desktop',
      style: {
        base: {
          display: 'block',
          width: '400px',
          height: '250px'
        }
      }
    },
    settings: {}
  }
});

export default Video;
