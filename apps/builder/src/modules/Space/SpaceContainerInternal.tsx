import { useToast } from '@plitzi/plitzi-ui/Toast';
import { useCallback, use, useMemo } from 'react';

import { spaceCallbacks, toInteractionCallback } from '@plitzi/sdk-interactions/authoring';
import InteractionsContext from '@plitzi/sdk-interactions/InteractionsContext';

import type { InteractionCallback } from '@plitzi/sdk-shared';
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

  return children;
};

export default SpaceContainerInternal;
