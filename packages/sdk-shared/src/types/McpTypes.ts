/* eslint-disable @typescript-eslint/no-explicit-any */

import type { AiContext, AiMode, AiUsage, PromptRole } from './AITypes';
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
import type { z, ZodObject } from 'zod';

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

export type McpAdapter<T extends Record<string, any> = any, R = any> = (args: T, ctx: AiContext) => Promise<R>;

export type McpAdapters = {
  getBuilderContext: McpAdapter<
    Record<string, unknown>,
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
  listSpaces: McpAdapter<
    Record<string, unknown>,
    { id: string; name: string; permanentUrl: string; verified: boolean }[]
  >;
  getSchema: McpAdapter<Record<string, unknown>, Schema | undefined>;
  getPageSchema: McpAdapter<
    { pageId?: string },
    { id: string; label: string; type: string; parentId: string | undefined }[] | undefined
  >;
  createElement: McpAdapter<{ element: Element; parentId?: string; position?: number }, Element | undefined>;
  getElement: McpAdapter<{ elementId: string }, Element | undefined>;
  listElements: McpAdapter<Record<string, unknown>, Element[] | undefined>;
  updateElement: McpAdapter<Element, Element>;
  deleteElement: McpAdapter<{ elementId: string }, boolean>;
  moveElement: McpAdapter<{ elementId: string; toParentId: string; dropPosition?: DropPosition }, boolean>;
  publishSchema: McpAdapter<Record<string, unknown>, { revision: number }>;
  listPlugins: McpAdapter<Record<string, unknown>, McpPlugin[]>;
  createPage: McpAdapter<{ name: string }, Element>;
  deletePage: McpAdapter<{ pageId: string }, boolean>;
  createPageFolder: McpAdapter<{ name: string; parentId?: string }, PageFolder>;
  updatePageFolder: McpAdapter<
    { id: string; updates: Partial<Pick<PageFolder, 'name' | 'slug' | 'parentId'>> },
    PageFolder
  >;
  deletePageFolder: McpAdapter<{ id: string }, boolean>;
  createVariable: McpAdapter<
    { variable: Pick<SchemaVariable, 'name' | 'type' | 'value' | 'category'> },
    SchemaVariable
  >;
  updateVariable: McpAdapter<{ variable: Partial<SchemaVariable> & { name: string } }, SchemaVariable>;
  deleteVariable: McpAdapter<{ name: string }, boolean>;
  createStyleVariable: McpAdapter<
    { category: StyleVariableCategory; name: string; value: StyleVariableValue },
    McpStyleVariable
  >;
  updateStyleVariable: McpAdapter<
    { category: StyleVariableCategory; name: string; value: StyleVariableValue },
    McpStyleVariable
  >;
  deleteStyleVariable: McpAdapter<{ category: StyleVariableCategory; name: string }, boolean>;
  createStyleSelector: McpAdapter<
    {
      displayMode: DisplayMode;
      selector: string;
      type: TagType;
      path?: StyleCategory;
      style?: StyleItem['attributes'];
      params?: Record<string, unknown>;
    },
    McpStyleSelector
  >;
  updateStyleSelector: McpAdapter<
    {
      displayMode: DisplayMode;
      selector: string;
      type: TagType;
      path?: StyleCategory;
      style?: StyleItem['attributes'];
      params?: Record<string, unknown>;
    },
    McpStyleSelector
  >;
  deleteStyleSelector: McpAdapter<{ displayMode: DisplayMode; selector: string }, boolean>;
  createSegment: McpAdapter<{ name: string; description: string }, McpSegment>;
  updateSegment: McpAdapter<{ segmentId: string; updates: { name?: string; description?: string } }, McpSegment>;
  deleteSegment: McpAdapter<{ segmentId: string }, boolean>;
  createSegmentElement: McpAdapter<
    {
      segmentId: string;
      element: { type: string; label: string; props?: Record<string, unknown> };
      parentId: string;
    },
    Element
  >;
  updateSegmentElement: McpAdapter<
    { segmentId: string; elementId: string; updates: { label?: string; props?: Record<string, unknown> } },
    Element
  >;
  moveSegmentElement: McpAdapter<
    { segmentId: string; elementId: string; toParentId: string; dropPosition?: DropPosition },
    boolean
  >;
  deleteSegmentElement: McpAdapter<{ segmentId: string; elementId: string }, boolean>;
  createSegmentVariable: McpAdapter<
    { segmentId: string; variable: Pick<SchemaVariable, 'name' | 'type' | 'value' | 'category'> },
    SchemaVariable
  >;
  updateSegmentVariable: McpAdapter<
    { segmentId: string; variable: Partial<SchemaVariable> & { name: string } },
    SchemaVariable
  >;
  deleteSegmentVariable: McpAdapter<{ segmentId: string; name: string }, boolean>;
  createSegmentStyleVariable: McpAdapter<
    { segmentId: string; category: StyleVariableCategory; name: string; value: StyleVariableValue },
    McpStyleVariable
  >;
  updateSegmentStyleVariable: McpAdapter<
    { segmentId: string; category: StyleVariableCategory; name: string; value: StyleVariableValue },
    McpStyleVariable
  >;
  deleteSegmentStyleVariable: McpAdapter<{ segmentId: string; category: StyleVariableCategory; name: string }, boolean>;
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

export type ToolCallEvent = {
  name: string;
  args: Record<string, unknown>;
  result: unknown;
};

export type StreamCallbacks = {
  onLog?: (level: 'error' | 'info' | 'debug', content: string) => void;
  onChunk?: (text: string) => void;
  onThinking?: (text: string) => void;
  onUsage?: (usage: Omit<AiUsage, 'usedPercent' | 'contextLimit'> & { contextLimit?: number }) => void;
  onBusy?: () => void;
  onToolStart?: (name: string, args: Record<string, unknown>) => void;
  onToolCall?: (event: ToolCallEvent) => void;
};

export type McpToolLifecycleHooks<T = unknown> = {
  can?: (name: string, args: Record<string, unknown>, ctx?: AiContext) => boolean | Promise<boolean>;
  before?: (
    name: string,
    args: Record<string, unknown>,
    ctx?: AiContext
  ) => boolean | undefined | Promise<boolean> | Promise<undefined>;
  after?: (name: string, args: Record<string, unknown>, result: T, ctx?: AiContext) => void | Promise<void>;
  onError?: (name: string, args: Record<string, unknown>, error: Error, ctx?: AiContext) => void | Promise<void>;
};

export type McpToolDefinition = {
  name: string;
  description: string;
  shortDescription?: string;
  parameters: Record<string, unknown>;
  allowedModes: AiMode[];
  operationType: ToolOperationType;
};

export type McpToolHandler = (
  args: Record<string, any>,
  ctx: AiContext
) =>
  | Promise<{ content: { type: 'text'; text: string }[]; isError?: true }>
  | { content: { type: 'text'; text: string }[]; isError?: true };

export type McpTool = {
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

// used for the default tools connected to adapters
export type McpToolAdapterDefinition = {
  name: string;
  adapterName: keyof McpAdapters;
  description: string;
  inputSchema: z.ZodObject;
  operationType: ToolOperationType;
};

export type McpServerConfig = {
  enabled?: boolean; // Whether the MCP endpoint is active. Defaults to true.
  path?: string; // URL path for the MCP endpoint. Defaults to '/mcp'.
  adapters: McpAdapters;
  tools?: McpTool[];
  prompts?: McpPrompt[];
};
