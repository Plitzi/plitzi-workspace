import type { Environment } from './CommonTypes';
import type { ToolCallEvent } from './McpTypes';

export type PromptRole = 'user' | 'assistant' | 'system';
export type AiMode = 'plan' | 'build';
export type AiRole = 'user' | 'assistant';
export type AiEffort = 'auto' | 'low' | 'medium' | 'high';
export type AIToolStatus = 'running' | 'done' | 'failed' | 'interrupted';

export type AiUsage = {
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  thinkingTokens?: number;
  contextLimit: number;
  usedPercent: number;
};

export type StreamCallbacks = {
  onLog?: (level: 'error' | 'info' | 'debug', content: string) => void;
  onChunk?: (text: string) => void;
  onThinking?: (text: string) => void;
  onUsage?: (usage: Omit<AiUsage, 'usedPercent' | 'contextLimit'> & { contextLimit?: number }) => void;
  onBusy?: () => void;
  onBeforeTool?: (name: string, args: Record<string, unknown>) => void;
  onToolSuccess?: (event: ToolCallEvent) => void;
  onToolError?: (event: ToolCallEvent) => void;
  onResourceRead?: (name: string, uri: string) => void;
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
