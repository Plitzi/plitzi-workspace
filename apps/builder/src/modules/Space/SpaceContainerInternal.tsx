import { useToast } from '@plitzi/plitzi-ui/Toast';
import { useCallback, use, useMemo } from 'react';

import InteractionsContext from '@plitzi/sdk-interactions/InteractionsContext';

import type { InteractionBaseCallback } from '@plitzi/sdk-shared';
import type { ReactNode } from 'react';

export type SpaceContainerInternalProps = {
  children?: ReactNode;
};

const SpaceContainerInternal = ({ children }: SpaceContainerInternalProps) => {
  const { addToast } = useToast();
  const { useInteractions } = use(InteractionsContext);

  const handleAddNotification = useCallback(
    (params: {
      content?: string;
      placement?: 'top-right' | 'top-center' | 'top-left' | 'bottom-right' | 'bottom-center' | 'bottom-left';
      appeareance?: 'info' | 'success' | 'warning' | 'error' | 'default';
      autoDismiss?: boolean;
      autoDismissTimeout?: number;
    }) => {
      const { placement, appeareance, autoDismiss, autoDismissTimeout } = params;
      let { content } = params;
      if (typeof content !== 'string') {
        content = JSON.stringify(content);
      }

      addToast(<div className="whitespace-break-spaces">{content}</div>, {
        appeareance,
        autoDismiss,
        placement,
        autoDismissTimeout
      });
    },
    [addToast]
  );

  const interactionCallbacks = useMemo<Record<string, InteractionBaseCallback>>(
    () => ({
      addNotification: {
        action: 'addNotification',
        title: 'Add Notification',
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
              { value: 'default', label: 'Default' },
              { value: 'success', label: 'Success' },
              { value: 'error', label: 'Error' },
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
            when: params => params.autoDismiss as boolean
          }
        }
      }
    }),
    [handleAddNotification]
  );

  useInteractions({ id: 'space', callbacks: interactionCallbacks });

  return children;
};

export default SpaceContainerInternal;
