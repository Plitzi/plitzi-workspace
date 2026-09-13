import { use, useCallback, useMemo } from 'react';

import { toInteractionCallbacks } from '@plitzi/sdk-shared/authoring/builder';

import { hostCallbacks } from './callbacks';
import InteractionsContext from '../../InteractionsContext';

import type { HostActions, InteractionCallbackParamValues } from '@plitzi/sdk-shared';
import type { ReactNode } from 'react';

export type HostInteractionsProps = {
  children?: ReactNode;
  /** What the embedding application is willing to be asked to do. Absent means it offers nothing. */
  actions?: HostActions;
};

/**
 * The bridge out of a space and into the application rendering it.
 *
 * It is registered whether or not the host offers anything, so a space authored against a host that has not been
 * updated yet fails the way every other unresolved callback does — by doing nothing — rather than by throwing in
 * the middle of a flow somebody is watching.
 */
const HostInteractions = ({ children, actions }: HostInteractionsProps) => {
  const { useInteractions } = use(InteractionsContext);

  const handleHostAction = useCallback(
    (params: InteractionCallbackParamValues<{ action: string; value?: unknown }>) => {
      const { action, value } = params;
      const handler = action ? actions?.[action] : undefined;
      if (!handler) {
        return;
      }

      // The whole params object, not just `value`: a host that wants more than one field can read them, and the
      // two named here are simply the ones this catalog declares.
      handler({ ...params, value });
    },
    [actions]
  );

  const interactionCallbacks = useMemo(
    () => toInteractionCallbacks(hostCallbacks, { hostAction: handleHostAction }),
    [handleHostAction]
  );

  useInteractions({ id: 'host', callbacks: interactionCallbacks });

  return children;
};

export default HostInteractions;
