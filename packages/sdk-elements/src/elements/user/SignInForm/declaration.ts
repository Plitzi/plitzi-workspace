/** Static declaration for SignInForm: type, default attributes and builder metadata. Data only, no React. */
import { elementDeclaration } from '@plitzi/sdk-shared/authoring';

import type { SignInFormProps } from './SignInForm';
import type { AuthorableAttributes } from '@plitzi/sdk-shared/authoring';

/** What this element can be authored with — its component's own props, minus what the runtime supplies. */
export type SignInFormAttributes = AuthorableAttributes<SignInFormProps>;

const SURFACE = 'light-dark(white, oklch(0.21 0.006 285.885))';
const LINE = 'light-dark(oklch(0.871 0.006 286.286), oklch(0.37 0.013 285.805))';
const INK = 'light-dark(oklch(0.21 0.006 285.885), oklch(0.985 0 0))';
const INK_ON_INK = 'light-dark(oklch(0.985 0 0), oklch(0.21 0.006 285.885))';
const DANGER = 'light-dark(oklch(0.505 0.213 27.518), oklch(0.704 0.191 22.216))';

const declaration = elementDeclaration<SignInFormAttributes>()({
  type: 'signInForm',
  contentAttributes: ['usernameLabel', 'passwordLabel', 'codeLabel', 'submitLabel'],
  content: {
    attributes: {
      usernameLabel: 'Email',
      passwordLabel: 'Password',
      codeLabel: 'Code',
      submitLabel: 'Sign in',
      redirectTo: '',
      wrongMessage: 'That email or password is not right.',
      unverifiedMessage: 'Confirm your email first: the link is in your inbox.',
      blockedMessage: 'This account cannot sign in.',
      ssoMessage: 'Your organization signs you in with its own single sign-on.',
      networkMessage: 'Signing in could not be reached. Try again in a moment.'
    },
    definition: {
      label: 'Sign-in Form',
      description:
        'The space’s sign-in. Through a provider that signs in by going out and back (`userProvider: "server"` — ' +
        '"Sign in with Plitzi" on the platform), one button; against the space’s own (`basic`), an email and a ' +
        'password, then the code of a second factor when the account has one. Each refusal says what it is — a wrong ' +
        'password, an address not confirmed, a blocked account, single sign-on, no network — in words of its own ' +
        '(`wrongMessage`…), and once in, a visitor goes to `redirectTo`, or back to the `?redirect=` of this site they ' +
        'were sent with. Its slots style each part: `field`, `label`, `input`, `submit`, `problem`.',
      items: [],
      styleSelectors: { field: '', label: '', input: '', submit: '', problem: '' }
    },
    market: {
      category: 'user',
      icon: 'fa-solid fa-right-to-bracket'
    },
    defaultStyle: {
      style: {
        base: {
          default: {
            display: 'flex',
            'flex-direction': 'column',
            gap: '12px',
            'max-width': '360px'
          }
        },
        field: {
          default: {
            display: 'flex',
            'flex-direction': 'column',
            gap: '4px'
          }
        },
        label: {
          default: {
            'font-size': '0.875em',
            'font-weight': 500
          }
        },
        input: {
          default: {
            'padding-top': '8px',
            'padding-right': '10px',
            'padding-bottom': '8px',
            'padding-left': '10px',
            border: `1px solid ${LINE}`,
            'border-top-left-radius': '8px',
            'border-top-right-radius': '8px',
            'border-bottom-left-radius': '8px',
            'border-bottom-right-radius': '8px',
            'background-color': SURFACE,
            color: 'inherit',
            font: 'inherit'
          }
        },
        submit: {
          default: {
            'padding-top': '10px',
            'padding-right': '14px',
            'padding-bottom': '10px',
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
            cursor: 'pointer'
          }
        },
        problem: {
          default: {
            margin: '0px',
            color: DANGER,
            'font-size': '0.875em'
          }
        }
      },
      subTypes: {}
    }
  }
});

export default declaration;
