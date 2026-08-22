/** Static declaration for Video: type, default attributes and builder metadata. Data only, no React. */
import { elementDeclaration } from '../../../authoring/declare';

import type { VideoProps } from './Video';
import type { AuthorableAttributes } from '../../../authoring/declare';

/** What this element can be authored with — its component's own props, minus what the runtime supplies. */
export type VideoAttributes = AuthorableAttributes<VideoProps>;

const declaration = elementDeclaration<VideoAttributes>()({
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
      description: 'Embeds a video from a URL.',
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
          default: {
            display: 'block',
            width: '400px',
            height: '250px'
          }
        }
      }
    },
    settings: {}
  }
});

export default declaration;
