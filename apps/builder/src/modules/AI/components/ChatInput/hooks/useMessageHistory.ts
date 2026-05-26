import { useCallback, useMemo, useRef } from 'react';

import type { AiMessage } from '@pmodules/AI/types';

const useMessageHistory = (messages: AiMessage[]) => {
  const userMessages = useMemo(
    () => messages.filter(m => m.role === 'user').map(m => m.content ?? '').filter(Boolean),
    [messages]
  );

  const historyIndexRef = useRef(-1);
  const draftRef = useRef('');

  const navigatePrev = useCallback(
    (currentValue: string): string | null => {
      if (userMessages.length === 0) {
        return null;
      }

      if (historyIndexRef.current === -1) {
        draftRef.current = currentValue;
        historyIndexRef.current = userMessages.length - 1;
      } else if (historyIndexRef.current > 0) {
        historyIndexRef.current--;
      } else {
        return null;
      }

      return userMessages[historyIndexRef.current];
    },
    [userMessages]
  );

  const navigateNext = useCallback((): string | null => {
    if (historyIndexRef.current === -1) {
      return null;
    }

    historyIndexRef.current++;
    if (historyIndexRef.current >= userMessages.length) {
      historyIndexRef.current = -1;

      return draftRef.current;
    }

    return userMessages[historyIndexRef.current];
  }, [userMessages]);

  const reset = useCallback(() => {
    historyIndexRef.current = -1;
    draftRef.current = '';
  }, []);

  return { navigatePrev, navigateNext, reset };
};

export default useMessageHistory;
