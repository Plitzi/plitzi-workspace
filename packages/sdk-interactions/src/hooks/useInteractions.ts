// Packages
import { use, useLayoutEffect } from 'react';

// Relatives
import InteractionsContext from '../InteractionsContext';

// Types
import type { ElementInteraction, InteractionBaseCallback, Subscriptor } from '@plitzi/sdk-shared';

export type UseInteractionsProps = {
  id: string;
  interactions?: Record<string, ElementInteraction>;
  triggers?: Record<string, InteractionBaseCallback>;
  callbacks?: Record<string, InteractionBaseCallback>;
  getAdditionalParams?: Subscriptor['getAdditionalParams'];
};

const useInteractions = ({
  id,
  interactions = {},
  triggers = {},
  callbacks = {},
  getAdditionalParams
}: UseInteractionsProps) => {
  const { interactionsManager } = use(InteractionsContext);

  useLayoutEffect(() => {
    if (typeof window !== 'undefined') {
      return;
    }

    interactionsManager.subscribe(id, interactions, triggers, callbacks, getAdditionalParams);

    return () => {
      interactionsManager.unsubscribe(id);
    };
  }, [id, interactions, triggers, callbacks, getAdditionalParams, interactionsManager]);
};

export default useInteractions;
