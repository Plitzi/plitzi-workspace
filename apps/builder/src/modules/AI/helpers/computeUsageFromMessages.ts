import type { AiMessage, AiUsage } from '../types';

const computeUsageFromMessages = (msgs: AiMessage[]): AiUsage | undefined => {
  let accumulatedOutput = 0;
  let accumulatedThinking = 0;
  let lastUsage: AiUsage | undefined;

  for (const msg of msgs) {
    if (msg.role === 'assistant' && msg.usage) {
      accumulatedOutput += msg.usage.outputTokens;
      accumulatedThinking += msg.usage.thinkingTokens ?? 0;
      lastUsage = msg.usage;
    }
  }

  if (!lastUsage) {
    return undefined;
  }

  return {
    ...lastUsage,
    outputTokens: accumulatedOutput,
    thinkingTokens: accumulatedThinking || undefined,
    totalTokens: lastUsage.inputTokens + accumulatedOutput
  };
};

export default computeUsageFromMessages;
