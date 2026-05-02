import type { PageFolder, SchemaVariable, DropPosition } from './SchemaTypes';
import type {
  DisplayMode,
  StyleCategory,
  StyleItem,
  StyleVariableCategory,
  StyleVariableValue,
  TagType
} from './StyleTypes';

export type McpSpace = {
  id: number;
  name: string;
  environments?: string[];
};

export type McpElement = {
  id: string;
  type: string;
  label: string;
  parentId?: string;
  props?: Record<string, unknown>;
  styles?: Record<string, unknown>;
  runtime?: 'server' | 'client' | 'shared';
  children?: string[];
};

export type McpSchema = {
  spaceId: number;
  environment: string;
  revision: number;
  elements: Record<string, McpElement>;
};

export type McpPlugin = {
  name: string;
  version?: string;
  description?: string;
};

export type McpPage = {
  id: string;
  name: string;
  isDefault: boolean;
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
  /** Return all spaces the agent may access. */
  listSpaces: () => Promise<McpSpace[]>;
  /** Return the full element tree for a space + environment. */
  getSchema: (spaceId: number, environment: string) => Promise<McpSchema | undefined>;
  /** Add a new element to the schema. Returns the created element with its generated ID. */
  createElement: (
    spaceId: number,
    environment: string,
    element: { type: string; label: string; props?: Record<string, unknown>; runtime?: 'server' | 'client' | 'shared' },
    parentId?: string,
    position?: number
  ) => Promise<McpElement>;
  /** Update an existing element's label, props, styles, or runtime. */
  updateElement: (
    spaceId: number,
    environment: string,
    elementId: string,
    updates: {
      label?: string;
      props?: Record<string, unknown>;
      styles?: Record<string, unknown>;
      runtime?: 'server' | 'client' | 'shared';
    }
  ) => Promise<McpElement>;
  /** Remove an element and its descendants from the schema. */
  deleteElement: (spaceId: number, environment: string, elementId: string) => Promise<void>;
  /** Move an element to a different parent. */
  moveElement: (
    spaceId: number,
    environment: string,
    elementId: string,
    toParentId: string,
    dropPosition?: DropPosition
  ) => Promise<{ success: boolean }>;
  /** Publish the current draft as a new revision. Returns the new revision number. */
  publishSchema: (spaceId: number, environment: string) => Promise<{ revision: number }>;
  /** Optional: list plugins registered in the system. */
  listPlugins?: () => Promise<McpPlugin[]>;
  /** Create a new page. */
  createPage: (spaceId: number, environment: string, name: string) => Promise<McpPage>;
  /** Delete a page by ID. */
  deletePage: (spaceId: number, environment: string, pageId: string) => Promise<void>;
  /** Create a new page folder. */
  createPageFolder: (spaceId: number, environment: string, name: string, parentId?: string) => Promise<PageFolder>;
  /** Update a page folder. */
  updatePageFolder: (
    spaceId: number,
    environment: string,
    id: string,
    updates: Partial<Pick<PageFolder, 'name' | 'slug' | 'parentId'>>
  ) => Promise<PageFolder>;
  /** Delete a page folder. */
  deletePageFolder: (spaceId: number, environment: string, id: string) => Promise<void>;
  /** Create a schema variable. */
  createVariable: (
    spaceId: number,
    environment: string,
    variable: Pick<SchemaVariable, 'name' | 'type' | 'value' | 'category'>
  ) => Promise<SchemaVariable>;
  /** Update a schema variable. */
  updateVariable: (
    spaceId: number,
    environment: string,
    variable: Partial<SchemaVariable> & { name: string }
  ) => Promise<SchemaVariable>;
  /** Delete a schema variable. */
  deleteVariable: (spaceId: number, environment: string, name: string) => Promise<void>;
  /** Create a global style variable. */
  createStyleVariable: (
    spaceId: number,
    environment: string,
    category: StyleVariableCategory,
    name: string,
    value: StyleVariableValue
  ) => Promise<McpStyleVariable>;
  /** Update a global style variable. */
  updateStyleVariable: (
    spaceId: number,
    environment: string,
    category: StyleVariableCategory,
    name: string,
    value: StyleVariableValue
  ) => Promise<McpStyleVariable>;
  /** Delete a global style variable. */
  deleteStyleVariable: (
    spaceId: number,
    environment: string,
    category: StyleVariableCategory,
    name: string
  ) => Promise<void>;
  /** Create a global style selector. */
  createStyleSelector: (
    spaceId: number,
    environment: string,
    displayMode: DisplayMode,
    selector: string,
    type: TagType,
    path?: StyleCategory,
    style?: StyleItem['attributes'],
    params?: Record<string, unknown>
  ) => Promise<McpStyleSelector>;
  /** Update a global style selector. */
  updateStyleSelector: (
    spaceId: number,
    environment: string,
    displayMode: DisplayMode,
    selector: string,
    type: TagType,
    path?: StyleCategory,
    style?: StyleItem['attributes'],
    params?: Record<string, unknown>
  ) => Promise<McpStyleSelector>;
  /** Delete a global style selector. */
  deleteStyleSelector: (
    spaceId: number,
    environment: string,
    displayMode: DisplayMode,
    selector: string
  ) => Promise<void>;
  /** Create a segment. */
  createSegment: (spaceId: number, name: string, description: string) => Promise<McpSegment>;
  /** Update a segment. */
  updateSegment: (
    spaceId: number,
    segmentId: string,
    updates: { name?: string; description?: string }
  ) => Promise<McpSegment>;
  /** Delete a segment. */
  deleteSegment: (spaceId: number, segmentId: string) => Promise<void>;
  /** Add an element to a segment. */
  createSegmentElement: (
    spaceId: number,
    segmentId: string,
    element: { type: string; label: string; props?: Record<string, unknown> },
    parentId: string
  ) => Promise<McpElement>;
  /** Update an element inside a segment. */
  updateSegmentElement: (
    spaceId: number,
    segmentId: string,
    elementId: string,
    updates: { label?: string; props?: Record<string, unknown> }
  ) => Promise<McpElement>;
  /** Move an element inside a segment. */
  moveSegmentElement: (
    spaceId: number,
    segmentId: string,
    elementId: string,
    toParentId: string,
    dropPosition?: DropPosition
  ) => Promise<{ success: boolean }>;
  /** Remove an element from a segment. */
  deleteSegmentElement: (spaceId: number, segmentId: string, elementId: string) => Promise<void>;
  /** Create a segment schema variable. */
  createSegmentVariable: (
    spaceId: number,
    segmentId: string,
    variable: Pick<SchemaVariable, 'name' | 'type' | 'value' | 'category'>
  ) => Promise<SchemaVariable>;
  /** Update a segment schema variable. */
  updateSegmentVariable: (
    spaceId: number,
    segmentId: string,
    variable: Partial<SchemaVariable> & { name: string }
  ) => Promise<SchemaVariable>;
  /** Delete a segment schema variable. */
  deleteSegmentVariable: (spaceId: number, segmentId: string, name: string) => Promise<void>;
  /** Create a segment style variable. */
  createSegmentStyleVariable: (
    spaceId: number,
    segmentId: string,
    category: StyleVariableCategory,
    name: string,
    value: StyleVariableValue
  ) => Promise<McpStyleVariable>;
  /** Update a segment style variable. */
  updateSegmentStyleVariable: (
    spaceId: number,
    segmentId: string,
    category: StyleVariableCategory,
    name: string,
    value: StyleVariableValue
  ) => Promise<McpStyleVariable>;
  /** Delete a segment style variable. */
  deleteSegmentStyleVariable: (
    spaceId: number,
    segmentId: string,
    category: StyleVariableCategory,
    name: string
  ) => Promise<void>;
};

export type McpToolHandler = (
  args: Record<string, unknown>
) =>
  | Promise<{ content: Array<{ type: 'text'; text: string }>; isError?: boolean }>
  | { content: Array<{ type: 'text'; text: string }>; isError?: boolean };

export type McpToolConfig = {
  name: string;
  description: string;
  inputSchema: object; // Zod schema o objeto JSON
  handler: McpToolHandler;
};

export type McpServerConfig = {
  enabled?: boolean; // Whether the MCP endpoint is active. Defaults to true.
  path?: string; // URL path for the MCP endpoint. Defaults to '/mcp'.
  adapters: McpAdapters;
  tools?: McpToolConfig[];
};
