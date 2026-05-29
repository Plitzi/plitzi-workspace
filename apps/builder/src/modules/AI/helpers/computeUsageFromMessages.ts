import type { AiMessage, AiUsage } from '../types';

const computeUsageFromMessages = (msgs: AiMessage[]): AiUsage | undefined => {
  let accumulatedInput = 0;
  let accumulatedOutput = 0;
  let accumulatedThinking = 0;
  let lastUsage: AiUsage | undefined;

  for (const msg of msgs) {
    if (msg.role === 'assistant' && msg.usage) {
      accumulatedOutput += msg.usage.outputTokens;
      accumulatedThinking += msg.usage.thinkingTokens ?? 0;
      accumulatedInput += msg.usage.inputTokens;
      lastUsage = msg.usage;
    }
  }

  if (!lastUsage) {
    return undefined;
  }

  return {
    ...lastUsage,
    inputTokens: accumulatedInput,
    outputTokens: accumulatedOutput,
    thinkingTokens: accumulatedThinking,
    totalTokens: accumulatedInput + accumulatedOutput,
    usedPercent: lastUsage.contextLimit ? ((accumulatedInput + accumulatedOutput) / lastUsage.contextLimit) * 100 : 0
  };
};

export default computeUsageFromMessages;
