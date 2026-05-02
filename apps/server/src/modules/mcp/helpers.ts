import { z } from 'zod';

import { StyleVariableCategory } from '@plitzi/sdk-shared';

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp';
import type { McpAdapters, McpElement, StyleCategory } from '@plitzi/sdk-shared';

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

export const registerBuiltInTools = (server: McpServer, adapters: McpAdapters) => {
  server.registerTool(
    'list_spaces',
    { description: 'List all spaces available in the system', inputSchema: z.object({}) },
    async () => {
      const spaces = await adapters.listSpaces();
      return ok(spaces);
    }
  );

  server.registerTool(
    'get_schema',
    {
      description: 'Get the full element tree for a space and environment',
      inputSchema: z.object({
        spaceId: z.number().describe('Space ID'),
        environment: z.string().describe('Environment name (e.g. main, production)')
      })
    },
    async ({ spaceId, environment }) => {
      const schema = await adapters.getSchema(spaceId, environment);
      if (!schema) {
        return err(`Schema not found for space ${spaceId} / ${environment}`);
      }
      return ok(schema);
    }
  );

  server.registerTool(
    'list_elements',
    {
      description: 'List all element IDs, types and labels for a space and environment',
      inputSchema: z.object({ spaceId: z.number(), environment: z.string() })
    },
    async ({ spaceId, environment }) => {
      const schema = await adapters.getSchema(spaceId, environment);
      if (!schema) {
        return err(`Schema not found for space ${spaceId} / ${environment}`);
      }
      const summary = Object.values(schema.elements).map(({ id, type, label, parentId, runtime }) => ({
        id,
        type,
        label,
        parentId,
        runtime
      }));
      return ok(summary);
    }
  );

  server.registerTool(
    'get_element',
    {
      description: 'Get the full details of a single element by ID',
      inputSchema: z.object({
        spaceId: z.number(),
        environment: z.string(),
        elementId: z.string().describe('Element ID')
      })
    },
    async ({ spaceId, environment, elementId }) => {
      const schema = await adapters.getSchema(spaceId, environment);
      if (!schema) {
        return err(`Schema not found for space ${spaceId} / ${environment}`);
      }
      const element = (schema.elements as Record<string, McpElement | undefined>)[elementId];
      if (!element) {
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
        spaceId: z.number(),
        environment: z.string(),
        type: z.string().describe('Component type (e.g. Container, Text, Button, Image)'),
        label: z.string().describe('Human-readable name for the element'),
        props: z.record(z.string(), z.unknown()).optional().describe('Component props/attributes'),
        runtime: z.enum(['server', 'client', 'shared']).optional().describe('Rendering runtime'),
        parentId: z.string().optional().describe('Parent element ID; omit to place at root'),
        position: z.number().optional().describe('Zero-based insertion index within the parent')
      })
    },
    async ({ spaceId, environment, type, label, props, runtime, parentId, position }) => {
      const element = await adapters.createElement(
        spaceId,
        environment,
        { type, label, props, runtime },
        parentId,
        position
      );
      return ok(element);
    }
  );

  server.registerTool(
    'update_element',
    {
      description: 'Update an existing element — label, props, styles, or runtime',
      inputSchema: z.object({
        spaceId: z.number(),
        environment: z.string(),
        elementId: z.string(),
        label: z.string().optional(),
        props: z.record(z.string(), z.unknown()).optional(),
        styles: z.record(z.string(), z.unknown()).optional(),
        runtime: z.enum(['server', 'client', 'shared']).optional()
      })
    },
    async ({ spaceId, environment, elementId, label, props, styles, runtime }) => {
      const element = await adapters.updateElement(spaceId, environment, elementId, {
        label,
        props,
        styles,
        runtime
      });
      return ok(element);
    }
  );

  server.registerTool(
    'delete_element',
    {
      description: 'Remove an element and all its descendants from the schema',
      inputSchema: z.object({ spaceId: z.number(), environment: z.string(), elementId: z.string() })
    },
    async ({ spaceId, environment, elementId }) => {
      await adapters.deleteElement(spaceId, environment, elementId);
      return ok({ deleted: elementId });
    }
  );

  server.registerTool(
    'publish_schema',
    {
      description: 'Publish the current draft schema as a new immutable revision',
      inputSchema: z.object({ spaceId: z.number(), environment: z.string() })
    },
    async ({ spaceId, environment }) => {
      const result = await adapters.publishSchema(spaceId, environment);
      return ok(result);
    }
  );

  server.registerTool(
    'move_element',
    {
      description: 'Move an element to a different parent',
      inputSchema: z.object({
        spaceId: z.number(),
        environment: z.string(),
        elementId: z.string(),
        toParentId: z.string(),
        dropPosition: z.enum(['top', 'bottom', 'left', 'right', 'inside', 'custom']).optional()
      })
    },
    async ({ spaceId, environment, elementId, toParentId, dropPosition }) => {
      const result = await adapters.moveElement(spaceId, environment, elementId, toParentId, dropPosition);
      return ok(result);
    }
  );

  server.registerTool(
    'create_page',
    {
      description: 'Create a new page in the space',
      inputSchema: z.object({ spaceId: z.number(), environment: z.string(), name: z.string() })
    },
    async ({ spaceId, environment, name }) => {
      const page = await adapters.createPage(spaceId, environment, name);
      return ok(page);
    }
  );

  server.registerTool(
    'delete_page',
    {
      description: 'Delete a page by ID',
      inputSchema: z.object({ spaceId: z.number(), environment: z.string(), pageId: z.string() })
    },
    async ({ spaceId, environment, pageId }) => {
      await adapters.deletePage(spaceId, environment, pageId);
      return ok({ deleted: pageId });
    }
  );

  server.registerTool(
    'create_page_folder',
    {
      description: 'Create a new page folder',
      inputSchema: z.object({
        spaceId: z.number(),
        environment: z.string(),
        name: z.string(),
        parentId: z.string().optional()
      })
    },
    async ({ spaceId, environment, name, parentId }) => {
      const folder = await adapters.createPageFolder(spaceId, environment, name, parentId);
      return ok(folder);
    }
  );

  server.registerTool(
    'update_page_folder',
    {
      description: 'Update a page folder',
      inputSchema: z.object({
        spaceId: z.number(),
        environment: z.string(),
        id: z.string(),
        name: z.string().optional(),
        slug: z.string().optional(),
        parentId: z.string().optional()
      })
    },
    async ({ spaceId, environment, id, name, slug, parentId }) => {
      const folder = await adapters.updatePageFolder(spaceId, environment, id, { name, slug, parentId });
      return ok(folder);
    }
  );

  server.registerTool(
    'delete_page_folder',
    {
      description: 'Delete a page folder',
      inputSchema: z.object({ spaceId: z.number(), environment: z.string(), id: z.string() })
    },
    async ({ spaceId, environment, id }) => {
      await adapters.deletePageFolder(spaceId, environment, id);
      return ok({ deleted: id });
    }
  );

  server.registerTool(
    'create_variable',
    {
      description: 'Create a schema variable',
      inputSchema: z.object({
        spaceId: z.number(),
        environment: z.string(),
        name: z.string(),
        type: variableTypesSchema,
        value: z.string(),
        category: z.string()
      })
    },
    async ({ spaceId, environment, name, type, value, category }) => {
      const variable = await adapters.createVariable(spaceId, environment, { name, type, value, category });
      return ok(variable);
    }
  );

  server.registerTool(
    'update_variable',
    {
      description: 'Update a schema variable',
      inputSchema: z.object({
        spaceId: z.number(),
        environment: z.string(),
        name: z.string(),
        type: variableTypesSchema.optional(),
        value: z.string().optional(),
        category: z.string().optional()
      })
    },
    async ({ spaceId, environment, name, type, value, category }) => {
      const variable = await adapters.updateVariable(spaceId, environment, { name, type, value, category });
      return ok(variable);
    }
  );

  server.registerTool(
    'delete_variable',
    {
      description: 'Delete a schema variable',
      inputSchema: z.object({ spaceId: z.number(), environment: z.string(), name: z.string() })
    },
    async ({ spaceId, environment, name }) => {
      await adapters.deleteVariable(spaceId, environment, name);
      return ok({ deleted: name });
    }
  );

  server.registerTool(
    'create_style_variable',
    {
      description: 'Create a global style variable',
      inputSchema: z.object({
        spaceId: z.number(),
        environment: z.string(),
        category: styleVariableCategories,
        name: z.string(),
        value: z.union([z.string(), z.number(), z.record(z.string(), z.unknown())])
      })
    },
    async ({ spaceId, environment, category, name, value }) => {
      const variable = await adapters.createStyleVariable(spaceId, environment, category, name, value);
      return ok(variable);
    }
  );

  server.registerTool(
    'update_style_variable',
    {
      description: 'Update a global style variable',
      inputSchema: z.object({
        spaceId: z.number(),
        environment: z.string(),
        category: styleVariableCategories,
        name: z.string(),
        value: z.union([z.string(), z.number(), z.record(z.string(), z.unknown())])
      })
    },
    async ({ spaceId, environment, category, name, value }) => {
      const variable = await adapters.updateStyleVariable(spaceId, environment, category, name, value);
      return ok(variable);
    }
  );

  server.registerTool(
    'delete_style_variable',
    {
      description: 'Delete a global style variable',
      inputSchema: z.object({
        spaceId: z.number(),
        environment: z.string(),
        category: styleVariableCategories,
        name: z.string()
      })
    },
    async ({ spaceId, environment, category, name }) => {
      await adapters.deleteStyleVariable(spaceId, environment, category, name);
      return ok({ deleted: name });
    }
  );

  server.registerTool(
    'create_style_selector',
    {
      description: 'Create a global style selector',
      inputSchema: z.object({
        spaceId: z.number(),
        environment: z.string(),
        displayMode: displayModes,
        selector: z.string(),
        type: tagTypes,
        path: z.string().optional(),
        style: z.record(z.string(), z.record(z.string(), z.unknown())).optional(),
        params: z.record(z.string(), z.unknown()).optional()
      })
    },
    async ({ spaceId, environment, displayMode, selector, type, path, style, params }) => {
      const selector_ = await adapters.createStyleSelector(
        spaceId,
        environment,
        displayMode,
        selector,
        type,
        path as StyleCategory | undefined,
        style ?? undefined,
        params
      );
      return ok(selector_);
    }
  );

  server.registerTool(
    'update_style_selector',
    {
      description: 'Update a global style selector',
      inputSchema: z.object({
        spaceId: z.number(),
        environment: z.string(),
        displayMode: displayModes,
        selector: z.string(),
        type: tagTypes,
        path: z.string().optional(),
        style: z.record(z.string(), z.record(z.string(), z.unknown())).optional(),
        params: z.record(z.string(), z.unknown()).optional()
      })
    },
    async ({ spaceId, environment, displayMode, selector, type, path, style, params }) => {
      const selector_ = await adapters.updateStyleSelector(
        spaceId,
        environment,
        displayMode,
        selector,
        type,
        path as StyleCategory | undefined,
        style ?? undefined,
        params
      );
      return ok(selector_);
    }
  );

  server.registerTool(
    'delete_style_selector',
    {
      description: 'Delete a global style selector',
      inputSchema: z.object({
        spaceId: z.number(),
        environment: z.string(),
        displayMode: displayModes,
        selector: z.string()
      })
    },
    async ({ spaceId, environment, displayMode, selector }) => {
      await adapters.deleteStyleSelector(spaceId, environment, displayMode, selector);
      return ok({ deleted: selector });
    }
  );

  if (adapters.listPlugins) {
    const listPlugins = adapters.listPlugins;
    server.registerTool(
      'list_plugins',
      { description: 'List all plugins registered in the system', inputSchema: z.object({}) },
      async () => {
        const plugins = await listPlugins();
        return ok(plugins);
      }
    );
  }

  server.registerTool(
    'create_segment',
    {
      description: 'Create a new segment',
      inputSchema: z.object({ spaceId: z.number(), name: z.string(), description: z.string() })
    },
    async ({ spaceId, name, description }) => {
      const segment = await adapters.createSegment(spaceId, name, description);
      return ok(segment);
    }
  );

  server.registerTool(
    'update_segment',
    {
      description: 'Update a segment',
      inputSchema: z.object({
        spaceId: z.number(),
        segmentId: z.string(),
        name: z.string().optional(),
        description: z.string().optional()
      })
    },
    async ({ spaceId, segmentId, name, description }) => {
      const segment = await adapters.updateSegment(spaceId, segmentId, { name, description });
      return ok(segment);
    }
  );

  server.registerTool(
    'delete_segment',
    {
      description: 'Delete a segment',
      inputSchema: z.object({ spaceId: z.number(), segmentId: z.string() })
    },
    async ({ spaceId, segmentId }) => {
      await adapters.deleteSegment(spaceId, segmentId);
      return ok({ deleted: segmentId });
    }
  );

  server.registerTool(
    'create_segment_element',
    {
      description: 'Add an element to a segment',
      inputSchema: z.object({
        spaceId: z.number(),
        segmentId: z.string(),
        elementType: z.string(),
        elementLabel: z.string(),
        elementProps: z.record(z.string(), z.unknown()).optional(),
        parentId: z.string()
      })
    },
    async ({ spaceId, segmentId, elementType, elementLabel, elementProps, parentId }) => {
      const element = await adapters.createSegmentElement(
        spaceId,
        segmentId,
        { type: elementType, label: elementLabel, props: elementProps },
        parentId
      );
      return ok(element);
    }
  );

  server.registerTool(
    'update_segment_element',
    {
      description: 'Update an element inside a segment',
      inputSchema: z.object({
        spaceId: z.number(),
        segmentId: z.string(),
        elementId: z.string(),
        label: z.string().optional(),
        props: z.record(z.string(), z.unknown()).optional()
      })
    },
    async ({ spaceId, segmentId, elementId, label, props }) => {
      const element = await adapters.updateSegmentElement(spaceId, segmentId, elementId, { label, props });
      return ok(element);
    }
  );

  server.registerTool(
    'move_segment_element',
    {
      description: 'Move an element inside a segment',
      inputSchema: z.object({
        spaceId: z.number(),
        segmentId: z.string(),
        elementId: z.string(),
        toParentId: z.string(),
        dropPosition: z.enum(['top', 'bottom', 'left', 'right', 'inside', 'custom']).optional()
      })
    },
    async ({ spaceId, segmentId, elementId, toParentId, dropPosition }) => {
      const result = await adapters.moveSegmentElement(spaceId, segmentId, elementId, toParentId, dropPosition);
      return ok(result);
    }
  );

  server.registerTool(
    'delete_segment_element',
    {
      description: 'Remove an element from a segment',
      inputSchema: z.object({ spaceId: z.number(), segmentId: z.string(), elementId: z.string() })
    },
    async ({ spaceId, segmentId, elementId }) => {
      await adapters.deleteSegmentElement(spaceId, segmentId, elementId);
      return ok({ deleted: elementId });
    }
  );

  server.registerTool(
    'create_segment_variable',
    {
      description: 'Create a segment schema variable',
      inputSchema: z.object({
        spaceId: z.number(),
        segmentId: z.string(),
        name: z.string(),
        type: variableTypesSchema,
        value: z.string(),
        category: z.string()
      })
    },
    async ({ spaceId, segmentId, name, type, value, category }) => {
      const variable = await adapters.createSegmentVariable(spaceId, segmentId, { name, type, value, category });
      return ok(variable);
    }
  );

  server.registerTool(
    'update_segment_variable',
    {
      description: 'Update a segment schema variable',
      inputSchema: z.object({
        spaceId: z.number(),
        segmentId: z.string(),
        name: z.string(),
        type: variableTypesSchema.optional(),
        value: z.string().optional(),
        category: z.string().optional()
      })
    },
    async ({ spaceId, segmentId, name, type, value, category }) => {
      const variable = await adapters.updateSegmentVariable(spaceId, segmentId, { name, type, value, category });
      return ok(variable);
    }
  );

  server.registerTool(
    'delete_segment_variable',
    {
      description: 'Delete a segment schema variable',
      inputSchema: z.object({ spaceId: z.number(), segmentId: z.string(), name: z.string() })
    },
    async ({ spaceId, segmentId, name }) => {
      await adapters.deleteSegmentVariable(spaceId, segmentId, name);
      return ok({ deleted: name });
    }
  );

  server.registerTool(
    'create_segment_style_variable',
    {
      description: 'Create a segment style variable',
      inputSchema: z.object({
        spaceId: z.number(),
        segmentId: z.string(),
        category: styleVariableCategories,
        name: z.string(),
        value: z.union([z.string(), z.number(), z.record(z.string(), z.unknown())])
      })
    },
    async ({ spaceId, segmentId, category, name, value }) => {
      const variable = await adapters.createSegmentStyleVariable(spaceId, segmentId, category, name, value);
      return ok(variable);
    }
  );

  server.registerTool(
    'update_segment_style_variable',
    {
      description: 'Update a segment style variable',
      inputSchema: z.object({
        spaceId: z.number(),
        segmentId: z.string(),
        category: styleVariableCategories,
        name: z.string(),
        value: z.union([z.string(), z.number(), z.record(z.string(), z.unknown())])
      })
    },
    async ({ spaceId, segmentId, category, name, value }) => {
      const variable = await adapters.updateSegmentStyleVariable(spaceId, segmentId, category, name, value);
      return ok(variable);
    }
  );

  server.registerTool(
    'delete_segment_style_variable',
    {
      description: 'Delete a segment style variable',
      inputSchema: z.object({
        spaceId: z.number(),
        segmentId: z.string(),
        category: styleVariableCategories,
        name: z.string()
      })
    },
    async ({ spaceId, segmentId, category, name }) => {
      await adapters.deleteSegmentStyleVariable(spaceId, segmentId, category, name);
      return ok({ deleted: name });
    }
  );
};
