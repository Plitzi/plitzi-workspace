/** Static declaration for Video: type, default attributes and builder metadata. Data only, no React. */
import { elementDeclaration } from '@plitzi/sdk-shared/authoring/declare';

import type { VideoProps } from './Video';
import type { AuthorableAttributes } from '@plitzi/sdk-shared/authoring/declare';

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
      description: 'Embeds a video from a URL.'
    },
    market: {
      category: 'media',
      icon: 'fa-solid fa-video'
    },
    defaultStyle: {
      style: {
        base: {
          default: {
            display: 'block',
            width: '400px',
            height: '250px'
          }
        }
      }
    }
  }
});

export default declaration;
