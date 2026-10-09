/** Static declaration for ModalContainer: type, default attributes and builder metadata. Data only, no React. */
import { elementDeclaration } from '@plitzi/sdk-shared/authoring/declare';

import type { ModalContainerProps } from './ModalContainer';
import type { AuthorableAttributes } from '@plitzi/sdk-shared/authoring/declare';

/** What this element can be authored with — its component's own props, minus what the runtime supplies. */
export type ModalContainerAttributes = AuthorableAttributes<ModalContainerProps>;

const declaration = elementDeclaration<ModalContainerAttributes>()({
  type: 'modalContainer',
  sourceType: 'modalContainer',
  triggers: {
    onModalOpen: {
      action: 'onModalOpen',
      title: 'On Modal Open',
      type: 'trigger',
      params: { metadata: { type: 'text', defaultValue: '' } },
      preview: { metadata: '' }
    },
    onModalClose: { action: 'onModalClose', title: 'On Modal Close', type: 'trigger', preview: {}, params: {} }
  },
  callbacks: {
    openModal: {
      action: 'openModal',
      title: 'Open Modal',
      type: 'callback',
      params: { metadata: { type: 'text', defaultValue: '' } },
      preview: { metadata: '' }
    },
    closeModal: { action: 'closeModal', title: 'Close Modal', type: 'callback', params: {}, preview: {} }
  },
  content: {
    attributes: {
      title: 'Modal Header',
      autoHideAfterClick: true
    },
    definition: {
      label: 'Modal Container',
      description:
        'A modal overlay container opened and closed through interactions; use for dialogs over the page. The element ' +
        'itself is fixed over the whole viewport, and holds two layers side by side — neither inside the other: ' +
        '`backgroundContainer`, the dim layer, `rgb(0 0 0 / 50%)` (its `background-color` is the whole dim), and ' +
        '`rootContainer`, the dialog, centred by `top: 50%`, `left: 50%` and ' +
        '`transform: translate3d(-50%, -50%, 0)` — to sit it near the top, set `top` and `transform: ' +
        'translateX(-50%)`; flex alignment on the dim layer moves nothing. Inside the dialog, top to bottom: ' +
        '`headerContainer` (with `headerTitle` and `headerCloseButton`) and `bodyContainer`.',
      items: [],
      /**
       * A modal nobody opens is the commonest hidden subtree on a page, and before this it was built, bound and
       * subscribed on every render of the page it sat in. `lazy` rather than `visible` so what a visitor typed into
       * one survives closing it — reopening a form that cleared itself is a worse bug than the cost this saves.
       */
      loadStrategy: 'lazy',
      styleSelectors: {
        backgroundContainer: '',
        rootContainer: '',
        headerContainer: '',
        headerTitle: '',
        headerCloseButton: '',
        bodyContainer: ''
      }
    },
    market: {
      category: 'structure',
      icon: 'fa-regular fa-clone'
    },
    defaultStyle: {
      style: {
        base: {
          default: {
            position: 'fixed',
            top: '0',
            bottom: '0',
            left: '0',
            right: '0',
            'z-index': '200'
          }
        },
        backgroundContainer: {
          default: {
            height: '100%',
            width: '100%',
            left: '0',
            top: '0',
            position: 'absolute',
            'z-index': '210',
            'background-color': 'rgb(0 0 0 / 50%)'
          }
        },
        rootContainer: {
          default: {
            display: 'flex',
            'flex-direction': 'column',
            position: 'absolute',
            top: '50%',
            left: '50%',
            'z-index': '250',
            width: '500px',
            'max-width': 'calc(100vw - 32px)',
            'max-height': 'calc(100dvh - 32px)',
            overflow: 'auto',
            'background-color': 'light-dark(white, oklch(0.21 0.006 285.885))',
            transform: 'translate3d(-50%, -50%, 0px)',
            'border-top-left-radius': '8px',
            'border-top-right-radius': '8px',
            'border-bottom-left-radius': '8px',
            'border-bottom-right-radius': '8px'
          }
        },
        headerContainer: {
          default: {
            display: 'flex',
            'align-items': 'center',
            'justify-content': 'space-between',
            'border-bottom-width': '1px',
            'border-bottom-color': 'light-dark(#d1d5db, oklch(0.37 0.013 285.805))',
            'border-bottom-style': 'solid',
            'padding-left': '20px',
            'padding-right': '20px',
            'padding-top': '10px',
            'padding-bottom': '10px'
          }
        },
        headerTitle: {
          default: {
            'font-size': '20px',
            'font-weight': '500',
            'line-height': '1.2'
          }
        },
        headerCloseButton: {
          default: {
            height: '28px',
            width: '28px',
            'padding-top': '4px',
            'padding-bottom': '4px',
            'padding-left': '4px',
            'padding-right': '4px',
            display: 'flex',
            'justify-content': 'center',
            'align-items': 'center',
            'flex-shrink': '0',
            'border-top-left-radius': '4px',
            'border-top-right-radius': '4px',
            'border-bottom-left-radius': '4px',
            'border-bottom-right-radius': '4px',
            'background-color': 'transparent',
            color: 'inherit',
            'font-style': 'inherit',
            'font-weight': 'inherit',
            'line-height': 'inherit',
            'font-family': 'inherit',
            'font-size': 'inherit',
            cursor: 'pointer'
          }
        },
        bodyContainer: {
          default: {
            display: 'flex',
            'flex-direction': 'column',
            'flex-grow': '1',
            'flex-basis': 'auto',
            'padding-top': '20px',
            'padding-bottom': '20px',
            'padding-left': '20px',
            'padding-right': '20px'
          }
        }
      },
      subTypes: {}
    }
  },
  initialItems: ['container']
});

export default declaration;
