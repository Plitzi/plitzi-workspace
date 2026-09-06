import { useCallback, use, useMemo } from 'react';

import { toInteractionCallbacks } from '@plitzi/sdk-shared/authoring/builder';
import { useCommonStoreSetter } from '@plitzi/sdk-shared/store';

import { stateCallbacks } from './callbacks';
import InteractionsContext from '../../InteractionsContext';

import type { InteractionCallbackParamValues } from '@plitzi/sdk-shared';
import type { ReactNode } from 'react';

export type StateInteractionsProps = {
  children?: ReactNode;
};

const StateInteractions = ({ children }: StateInteractionsProps) => {
  const { useInteractions } = use(InteractionsContext);
  // `unknown` covers both forms the store accepts here: a value for `setState`, and the updater `toggleState` needs
  // to flip what is already there. The typed hook cannot express an arbitrary runtime path, hence the cast.
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

  // Read and written in one pass through the store's updater form, so the value flipped is the one that is there at
  // that instant. A read-then-write would take the value from the flow's own snapshot, which is what made the
  // two-branch toggle depend on being one step behind.
  const handleToggleState = useCallback(
    (params: InteractionCallbackParamValues<{ key: string }>) => {
      const { key } = params;
      if (!key) {
        return;
      }

      setState(`runtime.state.${key}`, (prev: unknown) => !(prev === true || prev === 'true'));
    },
    [setState]
  );

  const handleClearState = useCallback(() => {
    setState('runtime.state', {});
  }, [setState]);

  const interactionCallbacks = useMemo(
    () =>
      toInteractionCallbacks(stateCallbacks, {
        setState: handleSetState,
        toggleState: handleToggleState,
        clearState: handleClearState
      }),
    [handleSetState, handleToggleState, handleClearState]
  );

  useInteractions({ id: 'state', callbacks: interactionCallbacks });

  return children;
};

export default StateInteractions;
