import type { Environment } from './CommonTypes';

export type PromptRole = 'user' | 'assistant' | 'system';
export type AiMode = 'plan' | 'build';

export type AiUsage = {
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  thinkingTokens?: number;
  contextLimit: number;
  usedPercent: number;
};

export type AiContext = {
  // backend
  userId: number;
  spaceId: number;
  environment: Environment;
  pubSub?: unknown;
  // frontend
  mode: AiMode;
  currentPageId?: string;
  elementSelected?: string;
  theme?: 'light' | 'dark';
};
