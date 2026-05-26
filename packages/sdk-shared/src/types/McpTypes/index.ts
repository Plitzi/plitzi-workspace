/* eslint-disable @typescript-eslint/no-explicit-any */

import type { AiContext, AiMode, PromptRole } from '../AITypes';
import type { StyleVariableCategory, StyleVariableValue } from '../StyleTypes';
import type { McpAdapters } from './McpAdapters';
import type { ToolAnnotations } from '@modelcontextprotocol/sdk/types';
import type { ZodType } from 'zod';

export * from './McpAdapters';

export type McpPlugin = {
  name: string;
  version?: string;
  description?: string;
};

export type McpStyleVariable = {
  category: StyleVariableCategory;
  name: string;
  value: StyleVariableValue;
};

export type McpSegment = {
  id?: string;
  identifier: string;
  definition: { name: string; description: string; baseElementId: string };
};

// Backend

export type ToolOperationType = 'read' | 'write';

export type McpPromptHandlerResult = {
  messages: { role: Exclude<PromptRole, 'system'>; content: { type: 'text'; text: string } }[];
};

export type McpPromptHandler = (args: Record<string, any>, ctx: AiContext) => Promise<McpPromptHandlerResult>;

export type McpPrompt = {
  name: string;
  definition: {
    title: string;
    description: string;
    argsSchema?: Record<string, any>;
  };
  handler: McpPromptHandler;
};

export type McpResource = {
  uri: string;
  name: string;
  description: string;
  mimeType: string;
  content: string;
};

export type McpToolHandlerResult = {
  content: { type: 'text'; text: string }[];
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
} & ({ adapterName: keyof McpAdapters } | { adapterName?: undefined; handler: McpToolHandler });

export type McpServerConfig = {
  enabled?: boolean; // Whether the MCP endpoint is active. Defaults to true.
  path?: string; // URL path for the MCP endpoint. Defaults to '/mcp'.
  adapters: Partial<McpAdapters>;
  tools?: McpTool[];
  prompts?: McpPrompt[];
  resources?: McpResource[];
};
