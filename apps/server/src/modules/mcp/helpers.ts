import { z } from 'zod';

import { StyleVariableCategory } from '@plitzi/sdk-shared';

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp';
import type { Element, McpAdapters, McpContext } from '@plitzi/sdk-shared';

const ok = (data: unknown) => ({ content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }] });
const err = (message: string) => ({ content: [{ type: 'text' as const, text: message }], isError: true as const });

const variableTypesSchema = z.enum([
  'text',
  'number',
  'email',
  'password',
  'select',
  'select2',
  'checkbox',
  'textarea',
  'color',
  'switch'
]);
const displayModes = z.enum(['desktop', 'tablet', 'mobile']);
const tagTypes = z.enum(['class', 'element', 'id']);
const styleVariableCategories = z.nativeEnum(StyleVariableCategory);

export const wrapHandler = <T extends (args: Record<string, unknown>, ctx: McpContext) => unknown>(
  handler: T,
  ctx: McpContext
) => {
  return (args: Record<string, unknown>) => handler(args, ctx) as ReturnType<T>;
};

export const registerBuiltInTools = (server: McpServer, adapters: Partial<McpAdapters>, ctx: McpContext) => {
  server.registerTool(
    'list_spaces',
    { description: 'List all spaces available in the user', inputSchema: z.object({}) },
    async () => {
      const spaces = await adapters.listSpaces?.({}, ctx);

      return ok(spaces);
    }
  );

  server.registerTool(
    'get_schema',
    { description: 'Get the full element tree for a space and environment', inputSchema: z.object({}) },
    async () => {
      const schema = await adapters.getSchema?.({}, ctx);
      if (!schema) {
        return err('Schema not found');
      }

      return ok(schema);
    }
  );

  server.registerTool(
    'list_elements',
    { description: 'List all element IDs, types and labels for a space and environment', inputSchema: z.object({}) },
    async () => {
      const schema = await adapters.getSchema?.({}, ctx);
      if (!schema) {
        return err('Schema not found');
      }

      const summary = (Object.values(schema.flat) as Element[]).map(({ id, definition }) => ({
        id,
        type: definition.type,
        label: definition.label,
        parentId: definition.parentId,
        runtime: definition.runtime
      }));

      return ok(summary);
    }
  );

  server.registerTool(
    'get_element',
    {
      description: 'Get the full details of a single element by ID',
      inputSchema: z.object({ elementId: z.string().describe('Element ID') })
    },
    async ({ elementId }: { elementId: string }) => {
      const schema = await adapters.getSchema?.({}, ctx);
      if (!schema) {
        return err('Schema not found');
      }

      const element = schema.flat[elementId];
      if (!(element as Element | undefined)) {
        return err(`Element ${elementId} not found`);
      }

      return ok(element);
    }
  );

  server.registerTool(
    'create_element',
    {
      description: 'Add a new element to the schema. Returns the created element with its generated ID.',
      inputSchema: z.object({
        element: z.object({
          type: z.string().describe('Component type (e.g. Container, Text, Button, Image)'),
          label: z.string().describe('Human-readable name for the element'),
          props: z.record(z.string(), z.unknown()).optional().describe('Component props/attributes'),
          runtime: z.enum(['server', 'client', 'shared']).optional().describe('Rendering runtime')
        }),
        parentId: z.string().optional().describe('Parent element ID; omit to place at root'),
        position: z.number().optional().describe('Zero-based insertion index within the parent')
      })
    },
    async ({
      element,
      parentId,
      position
    }: {
      element: { type: string; label: string; props?: Record<string, unknown>; runtime?: string };
      parentId?: string;
      position?: number;
    }) => {
      const result = await adapters.createElement?.(
        { element, parentId, position } as unknown as Parameters<typeof adapters.createElement>[0],
        ctx
      );

      return ok(result);
    }
  );

  server.registerTool(
    'update_element',
    {
      description: 'Update an existing element — label, props, styles, or runtime',
      inputSchema: z.object({
        elementId: z.string(),
        updates: z.object({
          label: z.string().optional(),
          props: z.record(z.string(), z.unknown()).optional(),
          styles: z.record(z.string(), z.unknown()).optional(),
          runtime: z.enum(['server', 'client', 'shared']).optional()
        })
      })
    },
    async ({
      elementId,
      updates
    }: {
      elementId: string;
      updates: { label?: string; props?: Record<string, unknown>; styles?: Record<string, unknown>; runtime?: string };
    }) => {
      const element = await adapters.updateElement?.(
        { elementId, updates } as unknown as Parameters<typeof adapters.updateElement>[0],
        ctx
      );

      return ok(element);
    }
  );

  server.registerTool(
    'delete_element',
    {
      description: 'Remove an element and all its descendants from the schema',
      inputSchema: z.object({ elementId: z.string() })
    },
    async ({ elementId }: { elementId: string }) => {
      await adapters.deleteElement?.({ elementId }, ctx);

      return ok({ deleted: elementId });
    }
  );

  server.registerTool(
    'publish_schema',
    { description: 'Publish the current draft schema as a new immutable revision', inputSchema: z.object({}) },
    async () => {
      const result = await adapters.publishSchema?.({}, ctx);

      return ok(result);
    }
  );

  server.registerTool(
    'move_element',
    {
      description: 'Move an element to a different parent',
      inputSchema: z.object({
        elementId: z.string(),
        toParentId: z.string(),
        dropPosition: z.enum(['top', 'bottom', 'left', 'right', 'inside', 'custom']).optional()
      })
    },
    async ({
      elementId,
      toParentId,
      dropPosition
    }: {
      elementId: string;
      toParentId: string;
      dropPosition?: string;
    }) => {
      const result = await adapters.moveElement?.(
        { elementId, toParentId, dropPosition } as unknown as Parameters<typeof adapters.moveElement>[0],
        ctx
      );

      return ok(result);
    }
  );

  server.registerTool(
    'create_page',
    { description: 'Create a new page in the space', inputSchema: z.object({ name: z.string() }) },
    async ({ name }: { name: string }) => {
      const page = await adapters.createPage?.({ name }, ctx);

      return ok(page);
    }
  );

  server.registerTool(
    'delete_page',
    { description: 'Delete a page by ID', inputSchema: z.object({ pageId: z.string() }) },
    async ({ pageId }: { pageId: string }) => {
      await adapters.deletePage?.({ pageId }, ctx);

      return ok({ deleted: pageId });
    }
  );

  server.registerTool(
    'create_page_folder',
    {
      description: 'Create a new page folder',
      inputSchema: z.object({ name: z.string(), parentId: z.string().optional() })
    },
    async ({ name, parentId }: { name: string; parentId?: string }) => {
      const folder = await adapters.createPageFolder?.({ name, parentId }, ctx);

      return ok(folder);
    }
  );

  server.registerTool(
    'update_page_folder',
    {
      description: 'Update a page folder',
      inputSchema: z.object({
        id: z.string(),
        updates: z.object({ name: z.string().optional(), slug: z.string().optional(), parentId: z.string().optional() })
      })
    },
    async ({ id, updates }: { id: string; updates: { name?: string; slug?: string; parentId?: string } }) => {
      const folder = await adapters.updatePageFolder?.({ id, updates }, ctx);

      return ok(folder);
    }
  );

  server.registerTool(
    'delete_page_folder',
    { description: 'Delete a page folder', inputSchema: z.object({ id: z.string() }) },
    async ({ id }: { id: string }) => {
      await adapters.deletePageFolder?.({ id }, ctx);

      return ok({ deleted: id });
    }
  );

  server.registerTool(
    'create_variable',
    {
      description: 'Create a schema variable',
      inputSchema: z.object({
        variable: z.object({ name: z.string(), type: variableTypesSchema, value: z.string(), category: z.string() })
      })
    },
    async ({ variable }: { variable: { name: string; type: string; value: string; category: string } }) => {
      const result = await adapters.createVariable?.(
        { variable } as unknown as Parameters<typeof adapters.createVariable>[0],
        ctx
      );

      return ok(result);
    }
  );

  server.registerTool(
    'update_variable',
    {
      description: 'Update a schema variable',
      inputSchema: z.object({
        variable: z.object({
          name: z.string(),
          type: variableTypesSchema.optional(),
          value: z.string().optional(),
          category: z.string().optional()
        })
      })
    },
    async ({ variable }: { variable: { name: string; type?: string; value?: string; category?: string } }) => {
      const result = await adapters.updateVariable?.(
        { variable } as unknown as Parameters<typeof adapters.updateVariable>[0],
        ctx
      );

      return ok(result);
    }
  );

  server.registerTool(
    'delete_variable',
    { description: 'Delete a schema variable', inputSchema: z.object({ name: z.string() }) },
    async ({ name }: { name: string }) => {
      await adapters.deleteVariable?.({ name }, ctx);

      return ok({ deleted: name });
    }
  );

  server.registerTool(
    'create_style_variable',
    {
      description: 'Create a global style variable',
      inputSchema: z.object({
        category: styleVariableCategories,
        name: z.string(),
        value: z.union([z.string(), z.number(), z.record(z.string(), z.unknown())])
      })
    },
    async ({
      category,
      name,
      value
    }: {
      category: string;
      name: string;
      value: string | number | Record<string, unknown>;
    }) => {
      const variable = await adapters.createStyleVariable?.(
        { category, name, value } as unknown as Parameters<typeof adapters.createStyleVariable>[0],
        ctx
      );

      return ok(variable);
    }
  );

  server.registerTool(
    'update_style_variable',
    {
      description: 'Update a global style variable',
      inputSchema: z.object({
        category: styleVariableCategories,
        name: z.string(),
        value: z.union([z.string(), z.number(), z.record(z.string(), z.unknown())])
      })
    },
    async ({
      category,
      name,
      value
    }: {
      category: string;
      name: string;
      value: string | number | Record<string, unknown>;
    }) => {
      const variable = await adapters.updateStyleVariable?.(
        { category, name, value } as unknown as Parameters<typeof adapters.updateStyleVariable>[0],
        ctx
      );

      return ok(variable);
    }
  );

  server.registerTool(
    'delete_style_variable',
    {
      description: 'Delete a global style variable',
      inputSchema: z.object({ category: styleVariableCategories, name: z.string() })
    },
    async ({ category, name }: { category: string; name: string }) => {
      await adapters.deleteStyleVariable?.(
        { category, name } as unknown as Parameters<typeof adapters.deleteStyleVariable>[0],
        ctx
      );

      return ok({ deleted: name });
    }
  );

  server.registerTool(
    'create_style_selector',
    {
      description: 'Create a global style selector',
      inputSchema: z.object({
        displayMode: displayModes,
        selector: z.string(),
        type: tagTypes,
        path: z.string().optional(),
        style: z.record(z.string(), z.record(z.string(), z.unknown())).optional(),
        params: z.record(z.string(), z.unknown()).optional()
      })
    },
    async ({
      displayMode,
      selector,
      type,
      path,
      style,
      params
    }: {
      displayMode: string;
      selector: string;
      type: string;
      path?: string;
      style?: Record<string, Record<string, unknown>>;
      params?: Record<string, unknown>;
    }) => {
      const selector_ = await adapters.createStyleSelector?.(
        { displayMode, selector, type, path, style, params } as unknown as Parameters<
          typeof adapters.createStyleSelector
        >[0],
        ctx
      );

      return ok(selector_);
    }
  );

  server.registerTool(
    'update_style_selector',
    {
      description: 'Update a global style selector',
      inputSchema: z.object({
        displayMode: displayModes,
        selector: z.string(),
        type: tagTypes,
        path: z.string().optional(),
        style: z.record(z.string(), z.record(z.string(), z.unknown())).optional(),
        params: z.record(z.string(), z.unknown()).optional()
      })
    },
    async ({
      displayMode,
      selector,
      type,
      path,
      style,
      params
    }: {
      displayMode: string;
      selector: string;
      type: string;
      path?: string;
      style?: Record<string, Record<string, unknown>>;
      params?: Record<string, unknown>;
    }) => {
      const selector_ = await adapters.updateStyleSelector?.(
        { displayMode, selector, type, path, style, params } as unknown as Parameters<
          typeof adapters.updateStyleSelector
        >[0],
        ctx
      );

      return ok(selector_);
    }
  );

  server.registerTool(
    'delete_style_selector',
    {
      description: 'Delete a global style selector',
      inputSchema: z.object({ displayMode: displayModes, selector: z.string() })
    },
    async ({ displayMode, selector }: { displayMode: string; selector: string }) => {
      await adapters.deleteStyleSelector?.(
        { displayMode, selector } as unknown as Parameters<typeof adapters.deleteStyleSelector>[0],
        ctx
      );

      return ok({ deleted: selector });
    }
  );

  if (adapters.listPlugins) {
    server.registerTool(
      'list_plugins',
      { description: 'List all plugins registered in the system', inputSchema: z.object({}) },
      async () => {
        const plugins = await adapters.listPlugins?.({}, ctx);

        return ok(plugins);
      }
    );
  }

  server.registerTool(
    'create_segment',
    { description: 'Create a new segment', inputSchema: z.object({ name: z.string(), description: z.string() }) },
    async ({ name, description }: { name: string; description: string }) => {
      const segment = await adapters.createSegment?.({ name, description }, ctx);

      return ok(segment);
    }
  );

  server.registerTool(
    'update_segment',
    {
      description: 'Update a segment',
      inputSchema: z.object({
        segmentId: z.string(),
        updates: z.object({ name: z.string().optional(), description: z.string().optional() })
      })
    },
    async ({ segmentId, updates }: { segmentId: string; updates: { name?: string; description?: string } }) => {
      const segment = await adapters.updateSegment?.({ segmentId, updates }, ctx);

      return ok(segment);
    }
  );

  server.registerTool(
    'delete_segment',
    { description: 'Delete a segment', inputSchema: z.object({ segmentId: z.string() }) },
    async ({ segmentId }: { segmentId: string }) => {
      await adapters.deleteSegment?.({ segmentId }, ctx);

      return ok({ deleted: segmentId });
    }
  );

  server.registerTool(
    'create_segment_element',
    {
      description: 'Add an element to a segment',
      inputSchema: z.object({
        segmentId: z.string(),
        element: z.object({ type: z.string(), label: z.string(), props: z.record(z.string(), z.unknown()).optional() }),
        parentId: z.string()
      })
    },
    async ({
      segmentId,
      element,
      parentId
    }: {
      segmentId: string;
      element: { type: string; label: string; props?: Record<string, unknown> };
      parentId: string;
    }) => {
      const result = await adapters.createSegmentElement?.({ segmentId, element, parentId }, ctx);

      return ok(result);
    }
  );

  server.registerTool(
    'update_segment_element',
    {
      description: 'Update an element inside a segment',
      inputSchema: z.object({
        segmentId: z.string(),
        elementId: z.string(),
        updates: z.object({ label: z.string().optional(), props: z.record(z.string(), z.unknown()).optional() })
      })
    },
    async ({
      segmentId,
      elementId,
      updates
    }: {
      segmentId: string;
      elementId: string;
      updates: { label?: string; props?: Record<string, unknown> };
    }) => {
      const element = await adapters.updateSegmentElement?.({ segmentId, elementId, updates }, ctx);

      return ok(element);
    }
  );

  server.registerTool(
    'move_segment_element',
    {
      description: 'Move an element inside a segment',
      inputSchema: z.object({
        segmentId: z.string(),
        elementId: z.string(),
        toParentId: z.string(),
        dropPosition: z.enum(['top', 'bottom', 'left', 'right', 'inside', 'custom']).optional()
      })
    },
    async ({
      segmentId,
      elementId,
      toParentId,
      dropPosition
    }: {
      segmentId: string;
      elementId: string;
      toParentId: string;
      dropPosition?: string;
    }) => {
      const result = await adapters.moveSegmentElement?.(
        { segmentId, elementId, toParentId, dropPosition } as unknown as Parameters<
          typeof adapters.moveSegmentElement
        >[0],
        ctx
      );

      return ok(result);
    }
  );

  server.registerTool(
    'delete_segment_element',
    {
      description: 'Remove an element from a segment',
      inputSchema: z.object({ segmentId: z.string(), elementId: z.string() })
    },
    async ({ segmentId, elementId }: { segmentId: string; elementId: string }) => {
      await adapters.deleteSegmentElement?.({ segmentId, elementId }, ctx);

      return ok({ deleted: elementId });
    }
  );

  server.registerTool(
    'create_segment_variable',
    {
      description: 'Create a segment schema variable',
      inputSchema: z.object({
        segmentId: z.string(),
        variable: z.object({ name: z.string(), type: variableTypesSchema, value: z.string(), category: z.string() })
      })
    },
    async ({
      segmentId,
      variable
    }: {
      segmentId: string;
      variable: { name: string; type: string; value: string; category: string };
    }) => {
      const result = await adapters.createSegmentVariable?.(
        { segmentId, variable } as unknown as Parameters<typeof adapters.createSegmentVariable>[0],
        ctx
      );

      return ok(result);
    }
  );

  server.registerTool(
    'update_segment_variable',
    {
      description: 'Update a segment schema variable',
      inputSchema: z.object({
        segmentId: z.string(),
        variable: z.object({
          name: z.string(),
          type: variableTypesSchema.optional(),
          value: z.string().optional(),
          category: z.string().optional()
        })
      })
    },
    async ({
      segmentId,
      variable
    }: {
      segmentId: string;
      variable: { name: string; type?: string; value?: string; category?: string };
    }) => {
      const result = await adapters.updateSegmentVariable?.(
        { segmentId, variable } as unknown as Parameters<typeof adapters.updateSegmentVariable>[0],
        ctx
      );

      return ok(result);
    }
  );

  server.registerTool(
    'delete_segment_variable',
    {
      description: 'Delete a segment schema variable',
      inputSchema: z.object({ segmentId: z.string(), name: z.string() })
    },
    async ({ segmentId, name }: { segmentId: string; name: string }) => {
      await adapters.deleteSegmentVariable?.({ segmentId, name }, ctx);

      return ok({ deleted: name });
    }
  );

  server.registerTool(
    'create_segment_style_variable',
    {
      description: 'Create a segment style variable',
      inputSchema: z.object({
        segmentId: z.string(),
        category: styleVariableCategories,
        name: z.string(),
        value: z.union([z.string(), z.number(), z.record(z.string(), z.unknown())])
      })
    },
    async ({
      segmentId,
      category,
      name,
      value
    }: {
      segmentId: string;
      category: string;
      name: string;
      value: string | number | Record<string, unknown>;
    }) => {
      const variable = await adapters.createSegmentStyleVariable?.(
        { segmentId, category, name, value } as unknown as Parameters<typeof adapters.createSegmentStyleVariable>[0],
        ctx
      );

      return ok(variable);
    }
  );

  server.registerTool(
    'update_segment_style_variable',
    {
      description: 'Update a segment style variable',
      inputSchema: z.object({
        segmentId: z.string(),
        category: styleVariableCategories,
        name: z.string(),
        value: z.union([z.string(), z.number(), z.record(z.string(), z.unknown())])
      })
    },
    async ({
      segmentId,
      category,
      name,
      value
    }: {
      segmentId: string;
      category: string;
      name: string;
      value: string | number | Record<string, unknown>;
    }) => {
      const variable = await adapters.updateSegmentStyleVariable?.(
        { segmentId, category, name, value } as unknown as Parameters<typeof adapters.updateSegmentStyleVariable>[0],
        ctx
      );

      return ok(variable);
    }
  );

  server.registerTool(
    'delete_segment_style_variable',
    {
      description: 'Delete a segment style variable',
      inputSchema: z.object({ segmentId: z.string(), category: styleVariableCategories, name: z.string() })
    },
    async ({ segmentId, category, name }: { segmentId: string; category: string; name: string }) => {
      await adapters.deleteSegmentStyleVariable?.(
        { segmentId, category, name } as unknown as Parameters<typeof adapters.deleteSegmentStyleVariable>[0],
        ctx
      );

      return ok({ deleted: name });
    }
  );
};
