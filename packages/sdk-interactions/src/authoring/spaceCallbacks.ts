import type { BuiltinGlobalCallback } from './globalCallbacks';

/**
 * The `space` source, which the SDK application registers rather than this package.
 *
 * Its declaration lives here anyway, with the rest of the interaction vocabulary: the app supplies the function
 * that shows a notification, and everything else about the action — its params, their defaults, what the editor
 * shows — is the same knowledge every other source keeps here, and splitting it by which module happens to call
 * `useInteractions` is how a catalog ends up being copied.
 */
export const spaceCallbacks = {
  addNotification: {
    source: 'space',
    title: 'Add Notification',
    strictParams: true,
    params: {
      content: {
        type: 'textarea',
        // The single most-confused param: `content` IS the notification's message/body. There is no `title`,
        // `message` or `type` param — put the user-facing text here.
        description:
          'The notification text shown to the user — this is the message body. There is no separate title/message/type param.',
        default: 'Content'
      },
      placement: {
        type: 'select',
        description: 'Where the toast appears on screen.',
        default: 'top-right',
        options: ['top-right', 'top-center', 'top-left', 'bottom-right', 'bottom-center', 'bottom-left']
      },
      appeareance: {
        type: 'select',
        // Intentionally the misspelling the SDK source uses — the runtime reads exactly this key.
        description: 'Visual style of the notification. NOTE: the key is spelled "appeareance".',
        default: 'success',
        options: ['success', 'danger', 'warning', 'info']
      },
      autoDismiss: {
        type: 'boolean',
        description: 'Whether the notification dismisses itself after a timeout.',
        default: true,
        canBind: false
      },
      autoDismissTimeout: {
        type: 'number',
        description: 'Milliseconds before auto-dismiss. Only applies when autoDismiss is true.',
        default: 5000,
        when: params => params.autoDismiss === true
      }
    }
  }
} satisfies Record<string, BuiltinGlobalCallback>;
