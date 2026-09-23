import { useToast } from '@plitzi/plitzi-ui/Toast';
import { useCallback, use, useMemo } from 'react';

import InteractionsContext from '@plitzi/sdk-interactions/InteractionsContext';
import { toInteractionCallback } from '@plitzi/sdk-shared/authoring/builder';
import { spaceCallbacks } from '@plitzi/sdk-shared/authoring/spaceCallbacks';
import useTheme, { SPACE_THEME_AREA } from '@plitzi/sdk-shared/theme/useTheme';

import type { ToastTypeOptions, ToastPosition } from '@plitzi/plitzi-ui/Toast';
import type { InteractionCallback, InteractionCallbackParamValues } from '@plitzi/sdk-shared';
import type { ReactNode } from 'react';

export type SpaceContainerInternalProps = {
  children: ReactNode;
};

const SpaceContainerInternal = ({ children }: SpaceContainerInternalProps) => {
  const { addToast } = useToast();
  const { useInteractions } = use(InteractionsContext);
  // The space's theme, not the library's default: a light toast on a dark page was the one thing on it that did not
  // follow the toggle.
  const { resolvedTheme } = useTheme(SPACE_THEME_AREA);

  const handleAddNotification = useCallback(
    (
      params: InteractionCallbackParamValues<{
        content: string;
        placement: string;
        appearance: string;
        autoDismiss: boolean;
        autoDismissTimeout?: number;
      }>
    ) => {
      const { placement, appearance, autoDismiss, autoDismissTimeout } = params;
      let { content } = params;
      if (typeof content !== 'string') {
        content = JSON.stringify(content);
      }

      addToast(<div className="whitespace-break-spaces">{content}</div>, {
        // plitzi-ui's toast spells its option `appeareance`; a space's step spells it correctly.
        appeareance: appearance as ToastTypeOptions,
        autoDismiss,
        placement: placement as ToastPosition,
        // transitionDuration,
        autoDismissTimeout,
        theme: resolvedTheme
      });
    },
    [addToast, resolvedTheme]
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
      {children}
    </>
  );
};

export default SpaceContainerInternal;
