import { z } from 'zod';

import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import type {
  AiMode,
  McpContent,
  McpTool,
  McpToolHandler,
  McpToolHandlerResult,
  ToolOperationType
} from '@plitzi/sdk-shared';

/** Convert a Zod schema to the JSON Schema an AI provider (Anthropic / OpenAI) expects in a tool definition.
 *  Delegates to Zod v4's built-in converter — one implementation, so descriptions, literal discriminators,
 *  enums, nested objects and recursive (z.lazy) shapes all survive and the provider sees the same contract an
 *  MCP client does. `io: 'input'` describes what the agent must SEND; `unrepresentable: 'any'` degrades an
 *  exotic type to an empty schema instead of throwing, so one unusual tool never breaks the whole tool list. */
export const zodToJsonSchema = (schema: unknown): Record<string, unknown> => {
  const json = z.toJSONSchema(schema as z.ZodType, {
    target: 'draft-7',
    io: 'input',
    unrepresentable: 'any'
  }) as Record<string, unknown>;
  // The provider tool schema does not need the dialect marker; drop it so the payload stays minimal.
  delete json.$schema;

  return json;
};

// The first text block of a tool result — the human/JSON payload an agent reads. Skips image blocks so an
// image-returning tool still surfaces its text meta (or an error message).
export const firstText = (content: McpContent[]): string | undefined =>
  content.find(block => block.type === 'text')?.text;

export const getAllowedModes = (operationType: ToolOperationType): AiMode[] => {
  return operationType === 'write' ? ['build'] : ['plan', 'build'];
};

export const toolResponseOk = (data: unknown, agentMessage?: string): McpToolHandlerResult => {
  // data is stored for the frontend renderer (via onToolSuccess) and never sent directly to the AI agent.
  // agentMessage controls what the agent reads — a brief confirmation for visual tools,
  // or the full JSON serialization when omitted (for info tools the agent must read).
  const text = agentMessage ?? JSON.stringify(data ?? null, null, 2);

  return { content: [{ type: 'text' as const, text }], data };
};

export const toolResponseErr = (error: Error | string): McpToolHandlerResult => ({
  content: [{ type: 'text' as const, text: error instanceof Error ? error.message : error }],
  isError: true as const
});

// A tool may return either a plain JSON value or an already-formed CallToolResult carrying its own content blocks
// (e.g. plitzi_screenshot's image blocks). One predicate, used by every host (the standalone MCP server and the
// in-process AI engine bridge), so image-returning tools are recognized identically everywhere.
export const isCallToolResult = (result: unknown): result is CallToolResult =>
  typeof result === 'object' && result !== null && Array.isArray((result as { content?: unknown }).content);

// Map a tool's CallToolResult into the engine's McpToolHandlerResult, keeping only the text and image blocks the
// providers can forward. Used by the in-process bridge so a screenshot reaches the co-worker as real image content
// instead of a JSON-stringified blob. `structuredContent` rides along as `data` (host-facing, never sent to the
// model), so a tool can hand the host a large payload — a render's offlineData — while the model pays only for the
// compact text content.
export const toolResponseFromResult = (result: CallToolResult): McpToolHandlerResult => {
  const content: McpContent[] = [];
  for (const block of result.content) {
    if (block.type === 'text') {
      content.push({ type: 'text', text: block.text });
    } else if (block.type === 'image') {
      content.push({ type: 'image', data: block.data, mimeType: block.mimeType });
    }
  }

  return { content, data: result.structuredContent, isError: result.isError ? true : undefined };
};

// A tool is usable when it carries a direct handler.
export const isToolActive = (tool: McpTool): boolean => Boolean(tool.handler);

// The single execution path for a tool: its own handler.
export const resolveToolHandler = (tool: McpTool): McpToolHandler | undefined => tool.handler;

// Keep only usable tools; every consumer (MCP server, providers, direct callers) runs them identically.
export const bindTools = (tools: McpTool[]): McpTool[] => tools.filter(isToolActive);
