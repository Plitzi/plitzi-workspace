export type OpenAIRole = 'user' | 'assistant';

export type OpenAIContentType = 'text' | 'html';

export type OpenAIMessage = {
  assistant_id?: string | null;
  attachments: unknown[];
  content: { text: { value: string; annotations?: unknown[] }; type: OpenAIContentType }[];
  created_at: number;
  id: string;
  metadata: object;
  object: string;
  role: OpenAIRole;
  run_id?: string | null;
  thread_id?: string | null;
};
