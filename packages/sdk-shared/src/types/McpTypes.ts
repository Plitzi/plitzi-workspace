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
  /** Publish the current draft as a new revision. Returns the new revision number. */
  publishSchema: (spaceId: number, environment: string) => Promise<{ revision: number }>;
  /** Optional: list plugins registered in the system. */
  listPlugins?: () => Promise<McpPlugin[]>;
};

export type McpServerConfig = {
  /** Whether the MCP endpoint is active. Defaults to true. */
  enabled?: boolean;
  /** URL path for the MCP endpoint. Defaults to '/mcp'. */
  path?: string;
  adapters: McpAdapters;
};
