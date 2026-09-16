import { use, useCallback, useMemo } from 'react';

import { toInteractionCallbacks } from '@plitzi/sdk-shared/authoring/builder';
import { invalidateQueries } from '@plitzi/sdk-shared/queries';

import { queriesCallbacks } from './callbacks';
import InteractionsContext from '../../InteractionsContext';

import type { InteractionCallbackParamValues } from '@plitzi/sdk-shared';
import type { ReactNode } from 'react';

export type QueriesInteractionsProps = {
  children?: ReactNode;
};

const QueriesInteractions = ({ children }: QueriesInteractionsProps) => {
  const { useInteractions } = use(InteractionsContext);

  // Awaited, so a step after this one reads what the providers on screen answered once asked again.
  const handleInvalidate = useCallback(
    (params: InteractionCallbackParamValues<{ url?: string }>) => invalidateQueries(params.url ?? ''),
    []
  );

  const interactionCallbacks = useMemo(
    () => toInteractionCallbacks(queriesCallbacks, { invalidateQueries: handleInvalidate }),
    [handleInvalidate]
  );

  useInteractions({ id: 'queries', callbacks: interactionCallbacks });

  return children;
};

export default QueriesInteractions;
