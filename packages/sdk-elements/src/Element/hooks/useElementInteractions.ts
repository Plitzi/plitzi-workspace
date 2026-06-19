import { set } from '@plitzi/plitzi-ui/helpers';
import { produce } from 'immer';
import { useCallback, useMemo, useRef } from 'react';

import getInteractions from '../helpers/getInteractions';

import type { Element, InteractionCallbackParamValues, InteractionPostCallback } from '@plitzi/sdk-shared';

export type UseElementInteractionsProps = {
  attributes: Element['attributes'];
  definition: Element['definition'];
  setElementState: <T extends Record<string, unknown> = Record<string, unknown>>(
    value?: T | ((prev: T) => T)
  ) => boolean;
};

// Helpers

const sanityValue = (value: string | boolean | number) => {
  if (typeof value !== 'string') {
    return value;
  }

  const valueParsed = value.toLowerCase();
  if (valueParsed === 'true' || valueParsed === 'false' || valueParsed === 'yes' || valueParsed === 'no') {
    return valueParsed === 'true' || valueParsed === 'yes';
  }

  return value;
};

const useElementInteractions = ({ attributes, definition, setElementState }: UseElementInteractionsProps) => {
  const prevStateRef = useRef<Record<string, unknown>>({});

  const setStateCallback = useCallback(
    (params: InteractionCallbackParamValues) => {
      const prevState = prevStateRef.current;
      if (!params.key || !params.value) {
        return { prevState, nextState: prevState };
      }

      const { key } = params;
      const value = sanityValue(params.value as string | number | boolean);
      const newState = produce(prevState, draft => set(draft, key as string, value));

      if (setElementState(newState)) {
        prevStateRef.current = newState;

        return { prevState, nextState: newState };
      }

      return { prevState, nextState: prevState };
    },
    [setElementState]
  );

  const setStatePostCallback: InteractionPostCallback = useCallback(
    (params, callbackResult) => {
      const { revertOnFinish } = params;
      if (
        !revertOnFinish ||
        !callbackResult ||
        !(callbackResult as { prevState: Record<string, unknown> | undefined }).prevState
      ) {
        return;
      }

      const { prevState } = callbackResult as { prevState: Record<string, unknown> };
      prevStateRef.current = prevState;
      setElementState(prevState);
    },
    [setElementState]
  );

  return useMemo(
    () => getInteractions(attributes, definition, setStateCallback, setStatePostCallback),
    [attributes, definition, setStateCallback, setStatePostCallback]
  );
};

export default useElementInteractions;
