import { useCallback, useState } from 'react';

import computeUsageFromMessages from '../helpers/computeUsageFromMessages';

import type { AiMessage, AiUsage } from '../types';

const useAiUsage = () => {
  const [usage, setUsage] = useState<AiUsage | undefined>();

  const accumulate = useCallback((newRaw: AiUsage) => {
    setUsage(prev => {
      const accumulatedOutput = (prev?.outputTokens ?? 0) + newRaw.outputTokens;
      const accumulatedThinking = (prev?.thinkingTokens ?? 0) + (newRaw.thinkingTokens ?? 0);

      return {
        ...newRaw,
        outputTokens: accumulatedOutput,
        thinkingTokens: accumulatedThinking || undefined,
        totalTokens: newRaw.inputTokens + accumulatedOutput
      };
    });
  }, []);

  const reset = useCallback(() => setUsage(undefined), []);

  const loadFromMessages = useCallback((msgs: AiMessage[]) => {
    setUsage(computeUsageFromMessages(msgs));
  }, []);

  return { usage, accumulate, reset, loadFromMessages };
};

export default useAiUsage;
