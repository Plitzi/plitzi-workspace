import { useCallback } from 'react';

import { useBuilderStore } from '@plitzi/sdk-shared/store';

/**
 * A journey's play, made as the server makes it — by a visitor with none of the editor's session, or as the journey's
 * own account (`playingJourney`, `GuestWhilePlaying`) — for as long as it lasts, however it ends.
 */
const usePlayJourney = (): (<T>(play: () => Promise<T>) => Promise<T>) => {
  const [, setPlayingJourney] = useBuilderStore('playingJourney');
  // The account a journey signed in as (`as`) is the journey's: none before it plays, none left after.
  const [, setTestAccount] = useBuilderStore('runtime.testAccount');

  return useCallback(
    async <T>(play: () => Promise<T>): Promise<T> => {
      setTestAccount(undefined);
      setPlayingJourney(true);
      try {
        return await play();
      } finally {
        setTestAccount(undefined);
        setPlayingJourney(false);
      }
    },
    [setPlayingJourney, setTestAccount]
  );
};

export default usePlayJourney;
