import { set } from '@plitzi/plitzi-ui/helpers';
import { produce } from 'immer';
import { useCallback, useMemo } from 'react';

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
  // The `setState` interaction reads and writes the element's state straight through `setElementState`'s functional
  // updater, which hands over the live slice from the store — the single source of truth. No shadow ref to keep in
  // sync (it could drift if the state changed elsewhere), and a chain of setStates builds on each other because the
  // store commits synchronously. `prevState` (captured from that live value) lets `revertOnFinish` restore it.
  const setStateCallback = useCallback(
    (params: InteractionCallbackParamValues) => {
      if (!params.key || !params.value) {
        return { prevState: undefined, nextState: undefined };
      }

      const { key } = params;
      const value = sanityValue(params.value as string | number | boolean);
      let prevState: Record<string, unknown> | undefined;
      let nextState: Record<string, unknown> | undefined;
      setElementState((prev: Record<string, unknown>) => {
        prevState = prev;
        nextState = produce(prev, (draft: Record<string, unknown>) => set(draft, key as string, value));

        return nextState;
      });

      return { prevState, nextState };
    },
    [setElementState]
  );

  const setStatePostCallback: InteractionPostCallback = useCallback(
    (params, callbackResult) => {
      const prevState = (callbackResult as { prevState?: Record<string, unknown> } | undefined)?.prevState;
      if (!params.revertOnFinish || !prevState) {
        return;
      }

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
