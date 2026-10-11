import type { BuiltinGlobalCallback } from './builder';

/** Where a notification may appear: the `addNotification` step's `placement`, and `useNotify`'s. */
export const NOTIFICATION_PLACEMENTS = [
  'top-right',
  'top-center',
  'top-left',
  'bottom-right',
  'bottom-center',
  'bottom-left'
] as const;

export type NotificationPlacement = (typeof NOTIFICATION_PLACEMENTS)[number];

/** How a notification looks: the `addNotification` step's `appearance`, and `useNotify`'s. */
export const NOTIFICATION_APPEARANCES = ['success', 'danger', 'warning', 'info'] as const;

export type NotificationAppearance = (typeof NOTIFICATION_APPEARANCES)[number];

/** What a notification takes besides its text — every one with the default the `addNotification` step has. */
export type NotificationOptions = {
  placement?: NotificationPlacement;
  appearance?: NotificationAppearance;
  autoDismiss?: boolean;
  /** Milliseconds before it dismisses itself, with `autoDismiss`. */
  autoDismissTimeout?: number;
};

/**
 * What a notification was handed, kept to what it takes — a flow's values arrive as written, and a plugin may be plain
 * JavaScript — with each field set aside named, so the caller says so rather than showing the default in silence.
 */
export const readNotificationOptions = (
  given: Readonly<Record<string, unknown>>
): { options: NotificationOptions; ignored: string[] } => {
  const placement = NOTIFICATION_PLACEMENTS.find(known => known === given.placement);
  const appearance = NOTIFICATION_APPEARANCES.find(known => known === given.appearance);
  const { autoDismiss, autoDismissTimeout } = given;
  const timeout =
    typeof autoDismissTimeout === 'number' && Number.isFinite(autoDismissTimeout) && autoDismissTimeout > 0
      ? autoDismissTimeout
      : undefined;
  const kept = {
    placement: placement !== undefined,
    appearance: appearance !== undefined,
    autoDismiss: typeof autoDismiss === 'boolean',
    autoDismissTimeout: timeout !== undefined
  };

  return {
    options: {
      ...(placement === undefined ? {} : { placement }),
      ...(appearance === undefined ? {} : { appearance }),
      ...(typeof autoDismiss === 'boolean' ? { autoDismiss } : {}),
      ...(timeout === undefined ? {} : { autoDismissTimeout: timeout })
    },
    ignored: Object.entries(kept)
      .filter(([name, ok]) => !ok && given[name] !== undefined)
      .map(([name]) => name)
  };
};

/** The defaults of a notification, the step's and the hook's alike. */
export const NOTIFICATION_DEFAULTS = {
  placement: 'top-right',
  appearance: 'success',
  autoDismiss: true,
  autoDismissTimeout: 5000
} as const satisfies Required<NotificationOptions>;

/**
 * The `space` source, which the SDK application registers rather than this package.
 *
 * Its declaration lives here anyway, with the rest of the interaction vocabulary: the app supplies the function
 * that shows a notification, and everything else about the action — its params, their defaults, what the editor
 * shows — is the same knowledge every other source keeps here, and splitting it by which module happens to call
 * `useInteractions` is how a catalog ends up being copied.
 */
export const spaceCallbacks: Record<string, BuiltinGlobalCallback> = {
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
        default: NOTIFICATION_DEFAULTS.placement,
        options: [...NOTIFICATION_PLACEMENTS]
      },
      appearance: {
        type: 'select',
        description: 'Visual style of the notification: success, danger, warning or info.',
        default: NOTIFICATION_DEFAULTS.appearance,
        options: [...NOTIFICATION_APPEARANCES]
      },
      autoDismiss: {
        type: 'boolean',
        description: 'Whether the notification dismisses itself after a timeout.',
        default: NOTIFICATION_DEFAULTS.autoDismiss,
        canBind: false
      },
      autoDismissTimeout: {
        type: 'number',
        description: 'Milliseconds before auto-dismiss. Only applies when autoDismiss is true.',
        default: NOTIFICATION_DEFAULTS.autoDismissTimeout,
        when: params => params.autoDismiss === true
      }
    }
  }
};
