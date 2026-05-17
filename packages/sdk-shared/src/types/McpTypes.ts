/* eslint-disable @typescript-eslint/no-explicit-any */

import type { AiContext, AiMode, PromptRole } from './AITypes';
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

export type McpAdapter<R = any, T extends Record<string, any> = Record<string, any>> = (
  args: T,
  ctx: AiContext
) => Promise<{ data: R } | { error: Error | string }>;

export type McpAdapters = {
  getBuilderContext: McpAdapter<
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
  listSpaces: McpAdapter<{ id: string; name: string; permanentUrl: string; verified: boolean }[]>;
  getSchema: McpAdapter<Schema | undefined>;
  getPageSchema: McpAdapter<
    { id: string; label: string; type: string; parentId: string | undefined }[] | undefined,
    { pageId?: string }
  >;
  createElement: McpAdapter<Element | undefined, { element: Element; parentId?: string; position?: number }>;
  getElement: McpAdapter<Element | undefined, { elementId: string }>;
  listElements: McpAdapter<Element[] | undefined, Record<string, unknown>>;
  updateElement: McpAdapter<Element, Element>;
  deleteElement: McpAdapter<boolean, { elementId: string }>;
  moveElement: McpAdapter<boolean, { elementId: string; toParentId: string; dropPosition?: DropPosition }>;
  publishSchema: McpAdapter<{ revision: number }>;
  listPlugins: McpAdapter<McpPlugin[]>;
  createPage: McpAdapter<Element, { name: string }>;
  deletePage: McpAdapter<boolean, { pageId: string }>;
  createPageFolder: McpAdapter<PageFolder, { name: string; parentId?: string }>;
  updatePageFolder: McpAdapter<
    PageFolder,
    { id: string; updates: Partial<Pick<PageFolder, 'name' | 'slug' | 'parentId'>> }
  >;
  deletePageFolder: McpAdapter<boolean, { id: string }>;
  createVariable: McpAdapter<
    SchemaVariable,
    { variable: Pick<SchemaVariable, 'name' | 'type' | 'value' | 'category'> }
  >;
  updateVariable: McpAdapter<SchemaVariable, { variable: Partial<SchemaVariable> & { name: string } }>;
  deleteVariable: McpAdapter<boolean, { name: string }>;
  createStyleVariable: McpAdapter<
    { category: StyleVariableCategory; name: string; value: StyleVariableValue },
    McpStyleVariable
  >;
  updateStyleVariable: McpAdapter<
    McpStyleVariable,
    { category: StyleVariableCategory; name: string; value: StyleVariableValue }
  >;
  deleteStyleVariable: McpAdapter<boolean, { category: StyleVariableCategory; name: string }>;
  createStyleSelector: McpAdapter<
    McpStyleSelector,
    {
      displayMode: DisplayMode;
      selector: string;
      type: TagType;
      path?: StyleCategory;
      style?: StyleItem['attributes'];
      params?: Record<string, unknown>;
    }
  >;
  updateStyleSelector: McpAdapter<
    McpStyleSelector,
    {
      displayMode: DisplayMode;
      selector: string;
      type: TagType;
      path?: StyleCategory;
      style?: StyleItem['attributes'];
      params?: Record<string, unknown>;
    }
  >;
  deleteStyleSelector: McpAdapter<boolean, { displayMode: DisplayMode; selector: string }>;
  createSegment: McpAdapter<McpSegment, { name: string; description: string }>;
  updateSegment: McpAdapter<McpSegment, { segmentId: string; updates: { name?: string; description?: string } }>;
  deleteSegment: McpAdapter<boolean, { segmentId: string }>;
  createSegmentElement: McpAdapter<
    Element,
    {
      segmentId: string;
      element: { type: string; label: string; props?: Record<string, unknown> };
      parentId: string;
    }
  >;
  updateSegmentElement: McpAdapter<
    Element,
    { segmentId: string; elementId: string; updates: { label?: string; props?: Record<string, unknown> } }
  >;
  moveSegmentElement: McpAdapter<
    boolean,
    { segmentId: string; elementId: string; toParentId: string; dropPosition?: DropPosition }
  >;
  deleteSegmentElement: McpAdapter<boolean, { segmentId: string; elementId: string }>;
  createSegmentVariable: McpAdapter<
    SchemaVariable,
    { segmentId: string; variable: Pick<SchemaVariable, 'name' | 'type' | 'value' | 'category'> }
  >;
  updateSegmentVariable: McpAdapter<
    SchemaVariable,
    { segmentId: string; variable: Partial<SchemaVariable> & { name: string } }
  >;
  deleteSegmentVariable: McpAdapter<boolean, { segmentId: string; name: string }>;
  createSegmentStyleVariable: McpAdapter<
    McpStyleVariable,
    { segmentId: string; category: StyleVariableCategory; name: string; value: StyleVariableValue }
  >;
  updateSegmentStyleVariable: McpAdapter<
    McpStyleVariable,
    { segmentId: string; category: StyleVariableCategory; name: string; value: StyleVariableValue }
  >;
  deleteSegmentStyleVariable: McpAdapter<boolean, { segmentId: string; category: StyleVariableCategory; name: string }>;
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
