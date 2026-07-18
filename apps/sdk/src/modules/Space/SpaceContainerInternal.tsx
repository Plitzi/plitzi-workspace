import { useToast } from '@plitzi/plitzi-ui/Toast';
import { useCallback, use, useMemo } from 'react';

import InteractionsContext from '@plitzi/sdk-interactions/InteractionsContext';

import type { ToastTypeOptions, ToastPosition } from '@plitzi/plitzi-ui/Toast';
import type { InteractionCallback, InteractionCallbackParamValues } from '@plitzi/sdk-shared';
import type { ReactNode } from 'react';

export type SpaceContainerInternalProps = {
  children: ReactNode;
};

const SpaceContainerInternal = ({ children }: SpaceContainerInternalProps) => {
  const { addToast } = useToast();
  const { useInteractions } = use(InteractionsContext);
  // const { Helmet } = use(NavigationContext);

  const handleAddNotification = useCallback(
    (
      params: InteractionCallbackParamValues<{
        content: string;
        placement: string;
        appeareance: string;
        autoDismiss: boolean;
        autoDismissTimeout?: number;
      }>
    ) => {
      const { placement, appeareance, autoDismiss, autoDismissTimeout } = params;
      let { content } = params;
      if (typeof content !== 'string') {
        content = JSON.stringify(content);
      }

      addToast(<div className="whitespace-break-spaces">{content}</div>, {
        appeareance: appeareance as ToastTypeOptions,
        autoDismiss,
        placement: placement as ToastPosition,
        // transitionDuration,
        autoDismissTimeout
      });
    },
    [addToast]
  );

  const interactionCallbacks = useMemo(
    () => ({
      addNotification: {
        title: 'Add Notification',
        action: 'addNotification',
        type: 'globalCallback',
        callback: handleAddNotification,
        preview: {},
        params: {
          content: {
            label: 'Content',
            defaultValue: 'Content',
            type: 'textarea'
          },
          placement: {
            label: 'Placement',
            defaultValue: 'top-right',
            type: 'select',
            options: [
              { value: 'top-right', label: 'Top Right' },
              { value: 'top-center', label: 'Top Center' },
              { value: 'top-left', label: 'Top Left' },
              { value: 'bottom-right', label: 'Bottom Right' },
              { value: 'bottom-center', label: 'Bottom Center' },
              { value: 'bottom-left', label: 'Bottom Left' }
            ]
          },
          appeareance: {
            label: 'Appeareance',
            defaultValue: 'success',
            type: 'select',
            options: [
              { value: 'success', label: 'Success' },
              { value: 'danger', label: 'Danger' },
              { value: 'warning', label: 'Warning' },
              { value: 'info', label: 'Info' }
            ]
          },
          autoDismiss: {
            label: 'Auto Dismiss',
            defaultValue: true,
            canBind: false,
            type: 'boolean'
          },
          autoDismissTimeout: {
            label: 'Auto Dismiss Timeout',
            defaultValue: 5000,
            type: 'text',
            when: params => params.autoDismiss
          }
        }
      } satisfies InteractionCallback<{
        content: string;
        placement: string;
        appeareance: string;
        autoDismiss: boolean;
        autoDismissTimeout?: number;
      }>
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
