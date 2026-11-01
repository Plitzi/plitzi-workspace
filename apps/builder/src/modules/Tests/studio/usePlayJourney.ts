import { useCallback, useRef } from 'react';

import { useBuilderStore } from '@plitzi/sdk-shared/store';

import type { SignedInTestAccount } from '@plitzi/sdk-shared';

/**
 * A journey's play, as its visitor from the first frame: its test account laid over the page before it is drawn — a
 * guest when none — and, however it ends, the visitor of the journey opened on the canvas laid over it again
 * (`JourneyVisitor`, `journeyOnCanvas`).
 */
const usePlayJourney = (): (<T>(account: SignedInTestAccount | undefined, play: () => Promise<T>) => Promise<T>) => {
  const [testAccount, setTestAccount] = useBuilderStore('runtime.testAccount');
  const opened = useRef(testAccount);
  opened.current = testAccount;

  return useCallback(
    async <T>(account: SignedInTestAccount | undefined, play: () => Promise<T>): Promise<T> => {
      const before = opened.current;
      setTestAccount(account);
      try {
        return await play();
      } finally {
        setTestAccount(before);
      }
    },
    [setTestAccount]
  );
};

export default usePlayJourney;
