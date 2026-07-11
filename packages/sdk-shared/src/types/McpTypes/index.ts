/* eslint-disable @typescript-eslint/no-explicit-any */

import type { AiContext, AiMode, PromptRole } from '../AITypes';
import type { ToolAnnotations } from '@modelcontextprotocol/sdk/types';
import type { ZodType } from 'zod';

// Backend

export type ToolOperationType = 'read' | 'write';

export type McpPromptHandlerResult = {
  messages: { role: Exclude<PromptRole, 'system'>; content: { type: 'text'; text: string } }[];
};

export type McpPromptHandler = (args: Record<string, any>, ctx: AiContext) => Promise<McpPromptHandlerResult>;

export type McpTextContent = { type: 'text'; text: string };
export type McpImageContent = { type: 'image'; data: string; mimeType: string };
export type McpContent = McpTextContent | McpImageContent;

export type McpToolHandlerResult = {
  content: McpContent[];
  data?: unknown;
  structuredContent?: Record<string, unknown>;
  isError?: true;
};

export type ToolCallEvent = {
  name: string;
  args: Record<string, unknown>;
  result: unknown;
};

export type McpToolLifecycleHooks = {
  can?: (name: string, args: Record<string, unknown>, ctx?: AiContext) => boolean | Promise<boolean>;
  before?: (
    name: string,
    args: Record<string, unknown>,
    ctx?: AiContext
  ) => boolean | undefined | Promise<boolean> | Promise<undefined>;
  after?: (
    name: string,
    args: Record<string, unknown>,
    result: McpToolHandlerResult,
    ctx?: AiContext
  ) => void | Promise<void>;
  onError?: (name: string, args: Record<string, unknown>, error: Error, ctx?: AiContext) => void | Promise<void>;
};

export type McpToolHandler<T extends Record<string, unknown> = any> = (
  args: T,
  ctx: AiContext
) => Promise<McpToolHandlerResult> | McpToolHandlerResult;

// Every tool carries a direct handler. bindTools() guarantees the handler is present, so the MCP server, the
// providers and any standalone caller all execute tools the exact same way.
export type McpTool = {
  name: string;
  mcpDefinition: {
    title?: string;
    description: string;
    inputSchema?: ZodType<any, any, any>;
    outputSchema?: ZodType<any, any, any>;
    annotations?: ToolAnnotations;
  };
  definition: {
    allowedModes: AiMode[];
  };
  handler?: McpToolHandler;
};

export type McpServerConfig = {
  enabled?: boolean; // Whether the MCP endpoint is active. Defaults to true.
  path?: string; // URL path for the MCP endpoint. Defaults to '/mcp'.
};
