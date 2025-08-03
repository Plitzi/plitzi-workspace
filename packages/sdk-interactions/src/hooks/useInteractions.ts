import { use, useEffect } from 'react';

import InteractionsContext from '../InteractionsContext';

import type { ElementInteraction, InteractionBaseCallback, Subscriptor } from '@plitzi/sdk-shared';

export type UseInteractionsProps = {
  id: string;
  interactions?: Record<string, ElementInteraction>;
  triggers?: Record<string, InteractionBaseCallback>;
  callbacks?: Record<string, InteractionBaseCallback>;
  getAdditionalParams?: Subscriptor['getAdditionalParams'];
};

const useInteractions = ({ id, interactions, triggers, callbacks, getAdditionalParams }: UseInteractionsProps) => {
  const { interactionsManager } = use(InteractionsContext);

  useEffect(() => {
    interactionsManager.subscribe(id, interactions, triggers, callbacks, getAdditionalParams);

    return () => {
      interactionsManager.unsubscribe(id);
    };
  }, [id, interactions, triggers, callbacks, getAdditionalParams, interactionsManager]);
};

export default useInteractions;
