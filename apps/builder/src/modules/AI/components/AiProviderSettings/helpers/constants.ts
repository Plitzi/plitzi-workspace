import type { AiProviderType } from '../../../types';

export const PROVIDERS: { value: AiProviderType; label: string }[] = [
  { value: 'openai', label: 'OpenAI' },
  { value: 'anthropic', label: 'Anthropic' },
  { value: 'ollama', label: 'Ollama (local)' },
  { value: 'openrouter', label: 'OpenRouter' },
  { value: 'opencode', label: 'OpenCode' }
];

export const BASE_URL_PLACEHOLDER: Partial<Record<AiProviderType, string>> = {
  ollama: 'http://localhost:11434/v1',
  opencode: 'http://localhost:4096'
};
