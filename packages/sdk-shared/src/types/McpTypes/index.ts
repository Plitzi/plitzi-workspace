/* eslint-disable @typescript-eslint/no-explicit-any */

import type { AiContext, AiMode, PromptRole } from '../AITypes';
import type {
  DisplayMode,
  StyleCategory,
  StyleItem,
  StyleVariableCategory,
  StyleVariableValue,
  TagType
} from '../StyleTypes';
import type { McpAdapters } from './McpAdapters';
import type { ToolAnnotations } from '@modelcontextprotocol/sdk/types';
import type { ZodObject } from 'zod';

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

export type McpStyleSelector = {
  displayMode: DisplayMode;
  selector: string;
  type: TagType;
  path?: StyleCategory;
  style?: StyleItem['attributes'];
  params: Record<string, unknown>;
};

export type McpSegment = {
  id?: string;
  identifier: string;
  definition: { name: string; description: string; baseElementId: string };
};

// Backend

export type ToolOperationType = 'read' | 'write' | 'admin';

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

export type McpToolHandlerResult = { content: { type: 'text'; text: string }[]; isError?: true };

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
    inputSchema?: ZodObject<any>;
    outputSchema?: ZodObject<any>;
    annotations?: ToolAnnotations;
  };
  definition: {
    parameters: Record<string, unknown>;
    allowedModes: AiMode[];
    operationType: ToolOperationType;
  };
} & ({ adapterName: keyof McpAdapters } | { adapterName?: undefined; handler: McpToolHandler });

export type McpServerConfig = {
  enabled?: boolean; // Whether the MCP endpoint is active. Defaults to true.
  path?: string; // URL path for the MCP endpoint. Defaults to '/mcp'.
  adapters: Partial<McpAdapters>;
  tools?: McpTool[];
  prompts?: McpPrompt[];
};
