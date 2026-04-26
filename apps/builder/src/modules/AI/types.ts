export type AiRole = 'user' | 'assistant';

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

export type AiMessage = {
  id: string;
  role: AiRole;
  content: string;
  attachments?: AiAttachment[];
  tools?: AiToolCall[];
  createdAt: number;
};

export type AiStreamEvent =
  | { type: 'chunk'; text: string }
  | { type: 'tool_start'; name: string; args: Record<string, unknown> }
  | { type: 'tool'; name: string; args: Record<string, unknown>; result: unknown }
  | { type: 'done'; message: AiMessage }
  | { type: 'error'; message: string };

export type AiContext = {
  spaceId?: number;
  environment?: string;
  currentPageId?: string;
  elementSelected?: string;
};
