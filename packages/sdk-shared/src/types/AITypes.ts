import type { Environment } from './CommonTypes';
import type { ToolCallEvent } from './McpTypes';

export type PromptRole = 'user' | 'assistant' | 'system';
export type AiMode = 'plan' | 'build';
export type AiRole = 'user' | 'assistant';
export type AiEffort = 'auto' | 'low' | 'medium' | 'high';
export type AIToolStatus = 'running' | 'done' | 'failed' | 'interrupted';
export type AiProviderType = 'openai' | 'anthropic' | 'ollama' | 'openrouter' | 'opencode';

export type AiUsage = {
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  thinkingTokens?: number;
  contextLimit: number;
  usedPercent: number;
};

export type AiMessageAttachment = {
  type: 'image';
  mimeType: string;
  data: string;
};

export type AiToolCall = {
  id: string;
  name: string;
  args?: Record<string, unknown>;
  result?: unknown;
  error?: string;
  status: AIToolStatus;
};

export type AiMessageStep =
  | { type: 'thinking'; text: string; durationMs?: number }
  | {
      type: 'tool';
      id: string;
      name: string;
      args?: Record<string, unknown>;
      result?: unknown;
      error?: string;
      status: AIToolStatus;
    }
  | { type: 'resource'; name: string; uri: string }
  | { type: 'text'; text: string };

export type ConversationSummary = {
  id: string;
  spaceId: number;
  messageCount: number;
  preview: string;
  createdAt: string;
  updatedAt: string;
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
