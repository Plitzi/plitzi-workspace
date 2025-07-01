// Packages
import { useCallback, use, useMemo } from 'react';
import { useToast } from '@plitzi/plitzi-ui/Toast';

// Monorepo
import InteractionsContext from '@plitzi/sdk-interactions/InteractionsContext';
// import NavigationContext from '@plitzi/sdk-navigation/NavigationContext';
// import SchemaSettingsContext from '@plitzi/sdk-schema/SchemaSettingsContext';

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
  // const { Helmet } = use(NavigationContext);
  // const { head } = use(SchemaSettingsContext);

  const handleAddNotification = useCallback(
    params => {
      const { placement, appeareance, autoDismiss, transitionDuration, autoDismissTimeout } = params;
      let { content } = params;
      if (typeof content !== 'string') {
        content = JSON.stringify(content);
      }

      addToast(<div className="whitespace-break-spaces">{content}</div>, {
        appeareance,
        autoDismiss,
        placement,
        transitionDuration,
        autoDismissTimeout
      });
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
