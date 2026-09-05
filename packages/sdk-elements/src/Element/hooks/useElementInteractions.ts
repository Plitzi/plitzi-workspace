import { get, set } from '@plitzi/plitzi-ui/helpers';
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
  // Every element write goes through `setElementState`'s functional updater, which hands over the live slice from the
  // store — the single source of truth. No shadow ref to keep in sync (it could drift if the state changed
  // elsewhere), and a chain of writes builds on each other because the store commits synchronously. `prevState`
  // (captured from that live value) lets `revertOnFinish` restore it, and `next` receives the value being replaced so
  // a toggle can be the same write as a set.
  const writeState = useCallback(
    (key: string, next: (prev: unknown) => unknown) => {
      let prevState: Record<string, unknown> | undefined;
      let nextState: Record<string, unknown> | undefined;
      setElementState((prev: Record<string, unknown>) => {
        prevState = prev;
        nextState = produce(prev, (draft: Record<string, unknown>) => set(draft, key, next(get(prev, key))));

        return nextState;
      });

      return { prevState, nextState };
    },
    [setElementState]
  );

  const setStateCallback = useCallback(
    (params: InteractionCallbackParamValues) => {
      // Only the key is required. `value` used to be guarded the same way, which quietly made `false`, `0` and `""`
      // no-ops — so a step that hid an element or unset a flag appeared to run and changed nothing, and the half of
      // a toggle that turns something OFF could not be written at all.
      if (!params.key || params.value === undefined) {
        return { prevState: undefined, nextState: undefined };
      }

      const { key } = params;
      const value = sanityValue(params.value as string | number | boolean);

      return writeState(key as string, () => value);
    },
    [writeState]
  );

  /**
   * The same write, reading the value it is about to replace — one step that turns a panel on and off from a single
   * trigger, rather than two branches whose `when` conditions have to be exact complements of each other.
   *
   * `undefined` counts as false, so a selector or a visibility flag that has never been set toggles ON first.
   */
  const toggleStateCallback = useCallback(
    (params: InteractionCallbackParamValues) => {
      if (!params.key) {
        return { prevState: undefined, nextState: undefined };
      }

      const { key } = params;

      return writeState(key as string, prev => sanityValue(prev as string | number | boolean) !== true);
    },
    [writeState]
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
    () => getInteractions(attributes, definition, setStateCallback, setStatePostCallback, toggleStateCallback),
    [attributes, definition, setStateCallback, setStatePostCallback, toggleStateCallback]
  );
};

export default useElementInteractions;
