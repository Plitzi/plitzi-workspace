export type AiRole = 'user' | 'assistant';

export type AiMessage = {
  id: string;
  role: AiRole;
  content: string;
  createdAt: number;
};

export type AiToolCallEvent = {
  type: 'tool';
  name: string;
  args: Record<string, unknown>;
  result: unknown;
};

export type AiStreamEvent =
  | { type: 'chunk'; text: string }
  | AiToolCallEvent
  | { type: 'done'; message: AiMessage }
  | { type: 'error'; message: string };

export type AiContext = {
  spaceId?: number;
  environment?: string;
  currentPageId?: string;
  elementSelected?: string;
};
