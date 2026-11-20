import { useToast } from '@plitzi/plitzi-ui/Toast';
import { useCallback, use, useMemo } from 'react';

import { InteractionsContext } from '@plitzi/sdk-interactions';
import { toInteractionCallback, spaceCallbacks } from '@plitzi/sdk-shared/authoring';
import { isGoalName } from '@plitzi/sdk-shared/experimentEvents';
import { useBuilderStoreGetter } from '@plitzi/sdk-shared/store';

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

  /**
   * A goal reached in the canvas's preview: nothing is counted — the builder reports to no analytics — so it says what
   * a visitor's page would count, with the A/B variants the canvas shows.
   */
  const getAssigned = useBuilderStoreGetter('experiments.assigned');

  const handleReachGoal = useCallback(
    (params: { goal?: unknown }) => {
      const { goal } = params;
      if (!isGoalName(goal)) {
        addToast(`reachGoal was given ${JSON.stringify(goal)}, which is not a goal's name: nothing would be counted.`, {
          appeareance: 'warning',
          autoDismiss: true,
          placement: 'top-right'
        });

        return;
      }

      const variants = Object.entries(getAssigned() ?? {}).map(
        ([experiment, variant]) => `${experiment} ${variant.toUpperCase()}`
      );
      addToast(
        `Goal "${goal}" reached. A visitor's page would count it as a conversion${variants.length > 0 ? ` of ${variants.join(', ')}` : ''}; the builder counts nothing.`,
        { appeareance: 'info', autoDismiss: true, placement: 'top-right' }
      );
    },
    [addToast, getAssigned]
  );

  const interactionCallbacks = useMemo<Record<string, InteractionCallback>>(
    () => ({
      addNotification: toInteractionCallback(
        'addNotification',
        spaceCallbacks.addNotification,
        handleAddNotification as InteractionCallback['callback']
      ),
      reachGoal: toInteractionCallback(
        'reachGoal',
        spaceCallbacks.reachGoal,
        handleReachGoal as InteractionCallback['callback']
      )
    }),
    [handleAddNotification, handleReachGoal]
  );

  useInteractions({ id: 'space', callbacks: interactionCallbacks });

  return children;
};

export default SpaceContainerInternal;
