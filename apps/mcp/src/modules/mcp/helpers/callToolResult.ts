import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';

// A tool may return either a plain JSON value or an already-formed CallToolResult carrying its own content blocks
// (e.g. a look's image blocks), which the server passes through as they are.
export const isCallToolResult = (result: unknown): result is CallToolResult =>
  typeof result === 'object' && result !== null && Array.isArray((result as { content?: unknown }).content);
