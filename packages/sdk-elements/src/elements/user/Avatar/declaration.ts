/** Static declaration for Avatar: type, default attributes and builder metadata. Data only, no React. */
import { elementDeclaration } from '@plitzi/sdk-shared/authoring';

import type { AvatarProps } from './Avatar';
import type { AuthorableAttributes } from '@plitzi/sdk-shared/authoring';

/** What this element can be authored with — its component's own props, minus what the runtime supplies. */
export type AvatarAttributes = AuthorableAttributes<AvatarProps>;

const declaration = elementDeclaration<AvatarAttributes>()({
  type: 'avatar',
  contentAttributes: ['src', 'name'],
  content: {
    attributes: { src: '', name: '', decorative: false },
    definition: {
      label: 'Avatar',
      description:
        'Shows a person by their picture (`src`), or — with none, or one that does not load — by their initials on a ' +
        'colour of their own, both drawn from their `name`; their outline with no name. A screen reader says the name; ' +
        '`decorative` when it is beside it already (a byline, a member row). `{{ auth.details.username }}` is the ' +
        'visitor’s own. 40px and round; its class sizes it, and its `image` slot styles the picture.',
      items: [],
      styleSelectors: { image: '' }
    },
    market: {
      category: 'user',
      icon: 'fa-solid fa-circle-user'
    },
    defaultStyle: {
      style: {
        base: {
          default: {
            display: 'inline-flex',
            'align-items': 'center',
            'justify-content': 'center',
            'flex-shrink': 0,
            width: '40px',
            height: '40px',
            overflow: 'hidden',
            'border-top-left-radius': '50%',
            'border-top-right-radius': '50%',
            'border-bottom-left-radius': '50%',
            'border-bottom-right-radius': '50%',
            'font-size': '15px',
            'font-weight': 600,
            'line-height': 1,
            'user-select': 'none',
            'background-color':
              'light-dark(oklch(0.9 0.06 var(--plitzi-avatar-hue, 260)), oklch(0.38 0.07 var(--plitzi-avatar-hue, 260)))',
            color:
              'light-dark(oklch(0.36 0.09 var(--plitzi-avatar-hue, 260)), oklch(0.93 0.04 var(--plitzi-avatar-hue, 260)))'
          }
        },
        image: {
          default: {
            width: '100%',
            height: '100%',
            'object-fit': 'cover'
          }
        }
      },
      subTypes: {}
    }
  }
});

export default declaration;
