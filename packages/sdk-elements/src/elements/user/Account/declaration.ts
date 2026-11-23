/** Static declaration for Account: type, default attributes and builder metadata. Data only, no React. */
import { elementDeclaration } from '@plitzi/sdk-shared/authoring';

import type { AccountProps } from './Account';
import type { AuthorableAttributes } from '@plitzi/sdk-shared/authoring';

/** What this element can be authored with — its component's own props, minus what the runtime supplies. */
export type AccountAttributes = AuthorableAttributes<AccountProps>;

/** The panel's floor in either scheme, as a dropdown's popup has it: an authored style beats it. */
const SURFACE = 'light-dark(white, oklch(0.21 0.006 285.885))';
const LINE = 'light-dark(oklch(0.92 0.004 286.32), oklch(0.32 0.006 285.885))';
const INK = 'light-dark(oklch(0.21 0.006 285.885), oklch(0.985 0 0))';
const INK_ON_INK = 'light-dark(oklch(0.985 0 0), oklch(0.21 0.006 285.885))';

const declaration = elementDeclaration<AccountAttributes>()({
  type: 'account',
  contentAttributes: ['signInLabel', 'signOutLabel'],
  content: {
    attributes: { signInHref: '', signInLabel: 'Sign in', signOutLabel: 'Sign out', signOutHref: '' },
    definition: {
      label: 'Account',
      description:
        'The visitor’s way in and their menu, in a top bar’s corner. A guest gets a "Sign in": to `signInHref` (the ' +
        'space’s sign-in page, with `?redirect=` back to where they were), or — empty — the provider’s own (on Plitzi, ' +
        '"Sign in with Plitzi", out and back). A visitor with a session gets their initials, opening a menu with their name ' +
        'and address, what it holds (its children: links to their profile, their settings) and "Sign out" ' +
        '(`signOutHref` where they go then; empty, they stay). Nothing shows while the session is still being found ' +
        'out. Its slots style each part: `signIn`, `trigger`, `panel`, `identity`, `signOut`.',
      items: [],
      styleSelectors: { signIn: '', trigger: '', panel: '', identity: '', signOut: '' }
    },
    market: {
      category: 'user',
      icon: 'fa-solid fa-user-gear'
    },
    defaultStyle: {
      style: {
        base: {
          default: {
            position: 'relative',
            display: 'inline-flex',
            'align-items': 'center'
          }
        },
        signIn: {
          default: {
            display: 'inline-flex',
            'align-items': 'center',
            'padding-top': '8px',
            'padding-right': '14px',
            'padding-bottom': '8px',
            'padding-left': '14px',
            'border-top-width': '0px',
            'border-right-width': '0px',
            'border-bottom-width': '0px',
            'border-left-width': '0px',
            'border-top-left-radius': '8px',
            'border-top-right-radius': '8px',
            'border-bottom-left-radius': '8px',
            'border-bottom-right-radius': '8px',
            'background-color': INK,
            color: INK_ON_INK,
            font: 'inherit',
            'font-weight': 600,
            'text-decoration': 'none',
            cursor: 'pointer'
          }
        },
        trigger: {
          default: {
            display: 'flex',
            'border-top-left-radius': '50%',
            'border-top-right-radius': '50%',
            'border-bottom-left-radius': '50%',
            'border-bottom-right-radius': '50%',
            cursor: 'pointer',
            'list-style': 'none'
          }
        },
        panel: {
          default: {
            position: 'absolute',
            top: 'calc(100% + 8px)',
            right: '0px',
            'z-index': 50,
            display: 'flex',
            'flex-direction': 'column',
            gap: '2px',
            'min-width': '220px',
            'padding-top': '8px',
            'padding-right': '8px',
            'padding-bottom': '8px',
            'padding-left': '8px',
            'border-top-left-radius': '12px',
            'border-top-right-radius': '12px',
            'border-bottom-left-radius': '12px',
            'border-bottom-right-radius': '12px',
            'background-color': SURFACE,
            'box-shadow': 'rgba(0, 0, 0, 0.1) 0px 0px 0px 1px, rgba(0, 0, 0, 0.12) 0px 8px 24px'
          }
        },
        identity: {
          default: {
            display: 'flex',
            'flex-direction': 'column',
            gap: '2px',
            'padding-top': '8px',
            'padding-right': '10px',
            'padding-bottom': '10px',
            'padding-left': '10px',
            'margin-bottom': '4px',
            'border-bottom': `1px solid ${LINE}`
          }
        },
        signOut: {
          default: {
            display: 'flex',
            width: '100%',
            'padding-top': '8px',
            'padding-right': '10px',
            'padding-bottom': '8px',
            'padding-left': '10px',
            'border-top-width': '0px',
            'border-right-width': '0px',
            'border-bottom-width': '0px',
            'border-left-width': '0px',
            'border-top-left-radius': '8px',
            'border-top-right-radius': '8px',
            'border-bottom-left-radius': '8px',
            'border-bottom-right-radius': '8px',
            'background-color': 'transparent',
            color: 'inherit',
            font: 'inherit',
            'text-align': 'left',
            cursor: 'pointer'
          }
        }
      },
      subTypes: {}
    }
  }
});

export default declaration;
