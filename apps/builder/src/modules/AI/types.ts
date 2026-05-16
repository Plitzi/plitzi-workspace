import type { Theme } from '@plitzi/sdk-shared';

export type AiRole = 'user' | 'assistant';
export type AiMode = 'plan' | 'build';
export type AiEffort = 'auto' | 'low' | 'medium' | 'high';
export type AIToolStatus = 'running' | 'failed' | 'done';

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
  status: AIToolStatus;
};

// elementId = element already in schema (post-creation)
// baseElementId = proposed template preview, elements injected via StoreProvider overlay
// Note: stage_preview is now processed in the backend, which validates schemas before sending
export type AiMessagePreview =
  | { elementId: string; baseElementId?: never }
  | {
      baseElementId: string;
      elementId?: never;
      schema?: { flat: Record<string, unknown> };
      style?: { platform?: unknown; cache?: string };
      elements?: Array<Record<string, unknown>>;
      success?: boolean;
      validationErrors?: Array<{ code: string; message: string; elementId?: string; details?: unknown }>;
      validationWarnings?: Array<string>;
      message?: string;
    }
  | Record<string, unknown>; // Backend may send a different format with validation errors

export type AiMessageAction = {
  id: string;
  label: string;
  variant?: 'primary' | 'danger' | 'default';
};

export type AiMessageClientTool = {
  id: string;
  name: string;
  args: Record<string, unknown>;
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
  clientTools?: AiMessageClientTool[];
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
  | { type: 'busy' }
  | { type: 'done'; message: AiMessage; usage?: AiUsage }
  | { type: 'error'; message: string; retryAfter?: number };

export type ConversationSummary = {
  id: string;
  spaceId: number;
  messageCount: number;
  preview: string;
  createdAt: string;
  updatedAt: string;
};

export type AiContext = {
  spaceId?: number;
  environment?: string;
  currentPageId?: string;
  elementSelected?: string;
  theme?: Theme;
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
  contextLimit?: number;
  supportsThinking?: boolean;
};

export type AiSkillSource = 'builtin' | 'team' | 'mine';
export type AiSkillCategory = 'design' | 'content' | 'data' | 'performance' | 'integrations' | 'enterprise';

export type AiSkill = {
  id: string;
  name: string;
  slash: string;
  source: AiSkillSource;
  cat: AiSkillCategory;
  desc: string;
  enabled: boolean;
  enterprise?: boolean;
  runs?: number;
  avg?: string;
  lastUsed?: string;
};
