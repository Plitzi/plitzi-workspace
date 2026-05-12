/* eslint-disable @typescript-eslint/no-explicit-any */

import type { Environment } from './CommonTypes';
import type { PageFolder, SchemaVariable, DropPosition, Element, Schema } from './SchemaTypes';
import type {
  DisplayMode,
  StyleCategory,
  StyleItem,
  StyleVariableCategory,
  StyleVariableValue,
  TagType
} from './StyleTypes';
import type { Theme } from './ThemeTypes';
import type { ToolAnnotations } from '@modelcontextprotocol/sdk/types';
import type { ZodObject } from 'zod';

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

export type McpAdapters = {
  getBuilderContext: (
    args: Record<string, unknown>,
    ctx: McpContext
  ) => Promise<
    | {
        currentPageId?: string;
        selectedElementId?: string;
        cssVariables: Record<string, { default: string; light?: string; dark?: string }> | undefined;
        elementDefaults: any;
        elements: { id: string; label: string; type: string; parentId?: string }[];
        theme?: Exclude<Theme, 'system'>;
      }
    | undefined
  >;
  listSpaces: (
    args: Record<string, unknown>,
    ctx: McpContext
  ) => Promise<{ id: string; name: string; permanentUrl: string; verified: boolean }[]>;
  getSchema: (args: Record<string, unknown>, ctx: McpContext) => Promise<Schema | undefined>;
  getPageSchema: (
    args: { pageId?: string },
    ctx: McpContext
  ) => Promise<{ id: string; label: string; type: string; parentId: string | undefined }[] | undefined>;
  createElement: (
    args: {
      element: {
        type: string;
        label: string;
        props?: Record<string, unknown>;
        runtime?: 'server' | 'client' | 'shared';
      };
      parentId?: string;
      position?: number;
    },
    ctx: McpContext
  ) => Promise<Element>;
  getElement: (args: { elementId: string }, ctx: McpContext) => Promise<Element | undefined>;
  updateElement: (
    args: {
      elementId: string;
      updates: {
        label?: string;
        props?: Record<string, unknown>;
        styles?: Record<string, unknown>;
        runtime?: 'server' | 'client' | 'shared';
      };
    },
    ctx: McpContext
  ) => Promise<Element>;
  deleteElement: (args: { elementId: string }, ctx: McpContext) => Promise<void>;
  moveElement: (
    args: { elementId: string; toParentId: string; dropPosition?: DropPosition },
    ctx: McpContext
  ) => Promise<{ success: boolean }>;
  publishSchema: (args: Record<string, unknown>, ctx: McpContext) => Promise<{ revision: number }>;
  listPlugins?: (args: Record<string, unknown>, ctx: McpContext) => Promise<McpPlugin[]>;
  createPage: (args: { name: string }, ctx: McpContext) => Promise<Element>;
  deletePage: (args: { pageId: string }, ctx: McpContext) => Promise<void>;
  createPageFolder: (args: { name: string; parentId?: string }, ctx: McpContext) => Promise<PageFolder>;
  updatePageFolder: (
    args: { id: string; updates: Partial<Pick<PageFolder, 'name' | 'slug' | 'parentId'>> },
    ctx: McpContext
  ) => Promise<PageFolder>;
  deletePageFolder: (args: { id: string }, ctx: McpContext) => Promise<void>;
  createVariable: (
    args: { variable: Pick<SchemaVariable, 'name' | 'type' | 'value' | 'category'> },
    ctx: McpContext
  ) => Promise<SchemaVariable>;
  updateVariable: (
    args: { variable: Partial<SchemaVariable> & { name: string } },
    ctx: McpContext
  ) => Promise<SchemaVariable>;
  deleteVariable: (args: { name: string }, ctx: McpContext) => Promise<void>;
  createStyleVariable: (
    args: { category: StyleVariableCategory; name: string; value: StyleVariableValue },
    ctx: McpContext
  ) => Promise<McpStyleVariable>;
  updateStyleVariable: (
    args: { category: StyleVariableCategory; name: string; value: StyleVariableValue },
    ctx: McpContext
  ) => Promise<McpStyleVariable>;
  deleteStyleVariable: (args: { category: StyleVariableCategory; name: string }, ctx: McpContext) => Promise<void>;
  createStyleSelector: (
    args: {
      displayMode: DisplayMode;
      selector: string;
      type: TagType;
      path?: StyleCategory;
      style?: StyleItem['attributes'];
      params?: Record<string, unknown>;
    },
    ctx: McpContext
  ) => Promise<McpStyleSelector>;
  updateStyleSelector: (
    args: {
      displayMode: DisplayMode;
      selector: string;
      type: TagType;
      path?: StyleCategory;
      style?: StyleItem['attributes'];
      params?: Record<string, unknown>;
    },
    ctx: McpContext
  ) => Promise<McpStyleSelector>;
  deleteStyleSelector: (args: { displayMode: DisplayMode; selector: string }, ctx: McpContext) => Promise<void>;
  createSegment: (args: { name: string; description: string }, ctx: McpContext) => Promise<McpSegment>;
  updateSegment: (
    args: { segmentId: string; updates: { name?: string; description?: string } },
    ctx: McpContext
  ) => Promise<McpSegment>;
  deleteSegment: (args: { segmentId: string }, ctx: McpContext) => Promise<void>;
  createSegmentElement: (
    args: {
      segmentId: string;
      element: { type: string; label: string; props?: Record<string, unknown> };
      parentId: string;
    },
    ctx: McpContext
  ) => Promise<Element>;
  updateSegmentElement: (
    args: { segmentId: string; elementId: string; updates: { label?: string; props?: Record<string, unknown> } },
    ctx: McpContext
  ) => Promise<Element>;
  moveSegmentElement: (
    args: { segmentId: string; elementId: string; toParentId: string; dropPosition?: DropPosition },
    ctx: McpContext
  ) => Promise<{ success: boolean }>;
  deleteSegmentElement: (args: { segmentId: string; elementId: string }, ctx: McpContext) => Promise<void>;
  createSegmentVariable: (
    args: { segmentId: string; variable: Pick<SchemaVariable, 'name' | 'type' | 'value' | 'category'> },
    ctx: McpContext
  ) => Promise<SchemaVariable>;
  updateSegmentVariable: (
    args: { segmentId: string; variable: Partial<SchemaVariable> & { name: string } },
    ctx: McpContext
  ) => Promise<SchemaVariable>;
  deleteSegmentVariable: (args: { segmentId: string; name: string }, ctx: McpContext) => Promise<void>;
  createSegmentStyleVariable: (
    args: { segmentId: string; category: StyleVariableCategory; name: string; value: StyleVariableValue },
    ctx: McpContext
  ) => Promise<McpStyleVariable>;
  updateSegmentStyleVariable: (
    args: { segmentId: string; category: StyleVariableCategory; name: string; value: StyleVariableValue },
    ctx: McpContext
  ) => Promise<McpStyleVariable>;
  deleteSegmentStyleVariable: (
    args: { segmentId: string; category: StyleVariableCategory; name: string },
    ctx: McpContext
  ) => Promise<void>;
};

// Backend

export type PromptRole = 'user' | 'assistant' | 'system';

export type McpContext = {
  // backend
  userId: number;
  spaceId: number;
  environment: Environment;
  pubSub?: unknown;
  callbacks?: StreamCallbacks;
  // frontend
  currentPageId?: string;
  elementSelected?: string;
  theme?: 'light' | 'dark';
};

export type McpPromptHandlerResult = {
  messages: { role: Exclude<PromptRole, 'system'>; content: { type: 'text'; text: string } }[];
};

export type McpPromptHandler = (
  args: Record<string, any>,
  ctx: McpContext
) => Promise<McpPromptHandlerResult> | McpPromptHandlerResult;

export type McpPromptConfig = {
  name: string;
  definition: {
    title: string;
    description: string;
    argsSchema?: Record<string, any>;
  };
  handler: McpPromptHandler;
};

export type AiUsage = {
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  thinkingTokens?: number;
  contextLimit: number;
  usedPercent: number;
};

export type ToolCallEvent = {
  name: string;
  args: Record<string, unknown>;
  result: unknown;
};

export type StreamCallbacks = {
  onChunk?: (text: string) => void;
  onThinking?: (text: string) => void;
  onUsage?: (usage: Omit<AiUsage, 'usedPercent' | 'contextLimit'> & { contextLimit?: number }) => void;
  onToolStart?: (name: string, args: Record<string, unknown>) => void;
  onToolCall?: (event: ToolCallEvent) => void;
  // For tools processed in backend but need to send result to AI // @todo: review to see if will be deprecated
  onTool?: (id: string, name: string, result: unknown, preview?: unknown) => void;
};

export type McpToolHandler = (
  args: Record<string, any>,
  ctx: McpContext
) =>
  | Promise<{ content: Array<{ type: 'text'; text: string }>; isError?: boolean }>
  | { content: Array<{ type: 'text'; text: string }>; isError?: boolean };

export type McpToolConfig = {
  name: string;
  definition: {
    title?: string;
    description: string;
    inputSchema?: ZodObject<any>;
    outputSchema?: ZodObject<any>;
    annotations?: ToolAnnotations;
  };
  handler: McpToolHandler;
};

export type McpServerConfig = {
  enabled?: boolean; // Whether the MCP endpoint is active. Defaults to true.
  path?: string; // URL path for the MCP endpoint. Defaults to '/mcp'.
  adapters: McpAdapters;
  tools?: McpToolConfig[];
  prompts?: McpPromptConfig[];
};
