// Packages
import React, { useCallback, use, useMemo } from 'react';
import useToast from '@plitzi/plitzi-ui-components/Toast/useToast';

// Monorepo
import InteractionsContext from '@plitzi/sdk-interactions/InteractionsContext';

/**
 * @param {{
 *   children: React.ReactNode;
 * }} props
 * @returns {React.ReactElement}
 */
const SpaceContainerInternal = props => {
  const { children } = props;
  const { addToast } = useToast();
  const { useInteractions } = use(InteractionsContext);

  const handleAddNotification = useCallback(
    params => {
      const { placement, appeareance, autoDismiss, transitionDuration, autoDismissTimeout } = params;
      let { content } = params;
      if (typeof content !== 'string') {
        content = JSON.stringify(content);
      }

      addToast(content, { appeareance, autoDismiss, placement, transitionDuration, autoDismissTimeout });
    },
    [addToast]
  );

  const interactionCallbacks = useMemo(
    () => ({
      addNotification: {
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
            when: params => !!params.autoDismiss
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
