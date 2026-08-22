import { useCallback, use, useMemo } from 'react';

import { useCommonStoreSetter } from '@plitzi/sdk-shared/store';

import { stateCallbacks } from './callbacks';
import { toInteractionCallback } from '../../authoring/builder';
import InteractionsContext from '../../InteractionsContext';

import type { InteractionCallback, InteractionCallbackParamValues } from '@plitzi/sdk-shared';
import type { ReactNode } from 'react';

export type StateInteractionsProps = {
  children?: ReactNode;
};

const StateInteractions = ({ children }: StateInteractionsProps) => {
  const { useInteractions } = use(InteractionsContext);
  const setState = useCommonStoreSetter() as (path: string, value: unknown) => void;

  const handleSetState = useCallback(
    (params: InteractionCallbackParamValues<{ key: string; type: string; value: string | boolean | number }>) => {
      const { key, type } = params;
      let { value } = params;
      if (type === 'boolean') {
        // The picker in the builder writes the WORD, and a bound or interpolated value arrives as whatever it
        // already was — a step reading `{{ someAction.output.done }}` hands over a real boolean. Reading only the
        // word turned every one of those into `false`, which is the answer that looks like it worked.
        value = value === true || value === 'true';
      } else if (type === 'number') {
        value = parseInt(value as string, 10);
      }

      setState(`runtime.state.${key}`, value);
    },
    [setState]
  );

  const handleClearState = useCallback(() => {
    setState('runtime.state', {});
  }, [setState]);

  const interactionCallbacks = useMemo(
    () => ({
      setState: toInteractionCallback('setState', stateCallbacks.setState, handleSetState as InteractionCallback['callback']),
      clearState: toInteractionCallback('clearState', stateCallbacks.clearState, handleClearState)
    }),
    [handleSetState, handleClearState]
  );

  useInteractions({ id: 'state', callbacks: interactionCallbacks });

  return children;
};

export default StateInteractions;
