import { useEffect, useRef } from 'react';

import { queryInputOf } from '../helpers/queryInput';

export type UseInputRefreshProps = {
  /** A server provider whose payload has arrived: there is a question to ask again. */
  enabled: boolean;
  /** The input as it resolves now — bound to state, it changes as the visitor does. */
  input: unknown;
  /** The input the element was saved with: what the page server resolved the first paint with. */
  savedInput: unknown;
  performQuery: (options: { input?: unknown }) => Promise<void>;
};

/**
 * A bound `input` asks again when what it says changes.
 *
 * The first paint was resolved by the page server with the input the element was SAVED with — bindings to the
 * visitor's state are not the server's to read — so that is what the first value is compared against: a binding that
 * already says something else (a state kept from the last visit) asks at once.
 */
const useInputRefresh = ({ enabled, input, savedInput, performQuery }: UseInputRefreshProps) => {
  // Compared by what it says: a binding resolves to a new object on every render.
  const inputKey = JSON.stringify(queryInputOf(input) ?? {});
  const askedKey = useRef(JSON.stringify(queryInputOf(savedInput) ?? {}));

  useEffect(() => {
    if (!enabled || inputKey === askedKey.current) {
      return;
    }

    askedKey.current = inputKey;
    void performQuery({ input });
  }, [enabled, inputKey, input, performQuery]);
};

export default useInputRefresh;
