import { use, useEffect } from 'react';

import InteractionsContext from '../InteractionsContext';

import type { ElementInteraction, InteractionCallback, Subscriptor } from '@plitzi/sdk-shared';

export type UseInteractionsProps<TParams extends Record<string, unknown> = Record<string, unknown>> = {
  /** The element's idRef: interactions are wired by ref only. Absent for an element that has none, which is then
   *  left unregistered rather than falling back to its opaque id. */
  id?: string;
  interactions?: Record<string, ElementInteraction>;
  triggers?: Record<string, InteractionCallback<TParams>>;
  callbacks?: Record<string, InteractionCallback<TParams>>;
  getAdditionalParams?: Subscriptor<TParams>['getAdditionalParams'];
};

const useInteractions = <TParams extends Record<string, unknown> = Record<string, unknown>>({
  id,
  interactions,
  triggers,
  callbacks,
  getAdditionalParams
}: UseInteractionsProps<TParams>) => {
  const { interactionsManager } = use(InteractionsContext);

  useEffect(() => {
    if (!id) {
      return;
    }

    interactionsManager.subscribe<TParams>(id, interactions, triggers, callbacks, getAdditionalParams);

    return () => {
      interactionsManager.unsubscribe(id);
    };
  }, [id, interactions, triggers, callbacks, getAdditionalParams, interactionsManager]);
};

export default useInteractions;
