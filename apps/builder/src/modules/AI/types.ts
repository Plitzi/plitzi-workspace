import type { Schema, Style } from '@plitzi/sdk-shared';

export type AiRole = 'user' | 'assistant';
export type AiMode = 'plan' | 'build';

export type AiAttachment = {
  id: string;
  type: 'image';
  mimeType: string;
  data: string; // base64
  name: string;
};

export type AiToolCall = {
  id: string;
  name: string;
  args?: Record<string, unknown>;
  result?: unknown;
  status: 'running' | 'done';
};

// elementId = element already in schema (post-creation)
// baseElementId = proposed template preview, elements injected via StoreProvider overlay
export type AiMessagePreview =
  | { elementId: string; baseElementId?: never }
  | {
      baseElementId: string;
      elementId?: never;
      schema: Pick<Schema, 'flat'>;
      style: Pick<Style, 'platform' | 'cache'>;
    };

export type AiMessageAction = {
  id: string;
  label: string;
  variant?: 'primary' | 'danger' | 'default';
};

export type AiMessage = {
  id: string;
  role: AiRole;
  content?: string;
  thinking?: string;
  thinkingDurationMs?: number;
  irrelevant?: boolean;
  mode?: AiMode;
  usage?: AiUsage;
  preview?: AiMessagePreview;
  actions?: AiMessageAction[];
  attachments?: AiAttachment[];
  tools?: AiToolCall[];
  createdAt: number;
};

export type AiUsage = {
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  thinkingTokens?: number;
  contextLimit: number;
  usedPercent: number;
};

export type AiStreamEvent =
  | { type: 'chunk'; text: string }
  | { type: 'thinking'; text: string }
  | { type: 'tool_start'; name: string; args: Record<string, unknown> }
  | { type: 'tool'; name: string; args: Record<string, unknown>; result: unknown }
  // Server delegates execution to the client; client runs the handler and stores any side-effects
  | { type: 'client_tool'; id: string; name: string; args: Record<string, unknown> }
  | { type: 'done'; message: AiMessage; usage?: AiUsage }
  | { type: 'error'; message: string };

export type AiContext = {
  spaceId?: number;
  environment?: string;
  currentPageId?: string;
  elementSelected?: string;
};

export type AiProviderType = 'openai' | 'anthropic' | 'ollama' | 'openrouter' | 'opencode';

export type AiProviderSettings = {
  provider?: AiProviderType;
  apiKey?: string;
  model?: string;
  baseUrl?: string;
};

export type AiModelInfo = {
  id: string;
  name: string;
  providerID?: string;
  providerName?: string;
  free?: boolean;
};
