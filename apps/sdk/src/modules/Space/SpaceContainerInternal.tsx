import { useToast } from '@plitzi/plitzi-ui/Toast';
import { useCallback, use, useMemo } from 'react';

import { InteractionsContext } from '@plitzi/sdk-interactions';
import { toInteractionCallback } from '@plitzi/sdk-shared/authoring';
import { NOTIFICATION_DEFAULTS, readNotificationOptions, spaceCallbacks } from '@plitzi/sdk-shared/authoring';
import { useTheme, SPACE_THEME_AREA } from '@plitzi/sdk-shared/theme';

import { NotifyContext } from './useNotify';

import type { Notify } from './useNotify';
import type { ToastTypeOptions } from '@plitzi/plitzi-ui/Toast';
import type { InteractionCallback, InteractionCallbackParamValues } from '@plitzi/sdk-shared';
import type { NotificationAppearance } from '@plitzi/sdk-shared/authoring';
import type { ReactNode } from 'react';

/** A space's appearance as the toast library names it: `danger` is its `error` — its icon, and its colour. */
const TOAST_TYPES: Record<NotificationAppearance, ToastTypeOptions> = {
  success: 'success',
  danger: 'error',
  warning: 'warning',
  info: 'info'
};

export type SpaceContainerInternalProps = {
  children: ReactNode;
};

const SpaceContainerInternal = ({ children }: SpaceContainerInternalProps) => {
  const { addToast } = useToast();
  const { useInteractions } = use(InteractionsContext);
  // The space's theme, not the library's default: a light toast on a dark page was the one thing on it that did not
  // follow the toggle.
  const { resolvedTheme } = useTheme(SPACE_THEME_AREA);

  // Wider than `Notify`: a flow's values arrive as written, and are read here like a plugin's.
  const notify = useCallback(
    (content: string, given: Readonly<Record<string, unknown>> = {}) => {
      const { options, ignored } = readNotificationOptions(given);
      if (ignored.length > 0) {
        console.warn(
          `[plitzi] notification "${content}": ${ignored.join(', ')} not one it takes — shown with the default instead`
        );
      }

      const { placement, appearance, autoDismiss, autoDismissTimeout } = { ...NOTIFICATION_DEFAULTS, ...options };
      addToast(<div className="whitespace-break-spaces">{content}</div>, {
        // plitzi-ui's toast spells its option `appeareance`; a space's step spells it correctly.
        appeareance: TOAST_TYPES[appearance],
        autoDismiss,
        placement,
        autoDismissTimeout,
        theme: resolvedTheme
      });
    },
    [addToast, resolvedTheme]
  );

  const handleAddNotification = useCallback(
    (params: InteractionCallbackParamValues<Record<string, unknown> & { content: unknown }>) => {
      const { content, ...options } = params;
      notify(typeof content === 'string' ? content : JSON.stringify(content), options);
    },
    [notify]
  );

  const interactionCallbacks = useMemo<Record<string, InteractionCallback>>(
    () => ({
      addNotification: toInteractionCallback(
        'addNotification',
        spaceCallbacks.addNotification,
        handleAddNotification as InteractionCallback['callback']
      )
    }),
    [handleAddNotification]
  );

  useInteractions({ id: 'space', callbacks: interactionCallbacks });

  // @todo: we need to render space headers here

  return (
    <>
      {/* {Helmet && head && (
        <Helmet>
          <link rel="preconnect" href="https://fonts.googleapis.com" />
          <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
          <link
            href="https://fonts.googleapis.com/css2?family=Lato:ital,wght
            @0,100;0,300;0,400;0,700;0,900;1,100;1,300;1,400;1,700;1,900&family=Rubik
            :wght@300;400;500;600;700;800;900&display=swap"
            rel="stylesheet"
          />
        </Helmet>
      )} */}
      <NotifyContext value={notify satisfies Notify}>{children}</NotifyContext>
    </>
  );
};

export default SpaceContainerInternal;
