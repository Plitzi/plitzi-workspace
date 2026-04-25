import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';

import type { McpAdapters, McpElement } from '@plitzi/sdk-shared';

const ok = (data: unknown) => ({ content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }] });
const err = (message: string) => ({ content: [{ type: 'text' as const, text: message }], isError: true as const });

export const createMcpServer = (adapters: McpAdapters): McpServer => {
  const server = new McpServer({ name: 'plitzi-schema-agent', version: '1.0.0' });

  server.tool('list_spaces', 'List all spaces available in the system', {}, async () => {
    const spaces = await adapters.listSpaces();
    return ok(spaces);
  });

  server.tool(
    'get_schema',
    'Get the full element tree for a space and environment',
    {
      spaceId: z.number().describe('Space ID'),
      environment: z.string().describe('Environment name (e.g. main, production)')
    },
    async ({ spaceId, environment }) => {
      const schema = await adapters.getSchema(spaceId, environment);
      if (!schema) {
        return err(`Schema not found for space ${spaceId} / ${environment}`);
      }
      return ok(schema);
    }
  );

  server.tool(
    'list_elements',
    'List all element IDs, types and labels for a space and environment',
    { spaceId: z.number(), environment: z.string() },
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

  server.tool(
    'get_element',
    'Get the full details of a single element by ID',
    { spaceId: z.number(), environment: z.string(), elementId: z.string().describe('Element ID') },
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

  server.tool(
    'create_element',
    'Add a new element to the schema. Returns the created element with its generated ID.',
    {
      spaceId: z.number(),
      environment: z.string(),
      type: z.string().describe('Component type (e.g. Container, Text, Button, Image)'),
      label: z.string().describe('Human-readable name for the element'),
      props: z.record(z.string(), z.unknown()).optional().describe('Component props/attributes'),
      runtime: z.enum(['server', 'client', 'shared']).optional().describe('Rendering runtime'),
      parentId: z.string().optional().describe('Parent element ID; omit to place at root'),
      position: z.number().optional().describe('Zero-based insertion index within the parent')
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

  server.tool(
    'update_element',
    'Update an existing element — label, props, styles, or runtime',
    {
      spaceId: z.number(),
      environment: z.string(),
      elementId: z.string(),
      label: z.string().optional(),
      props: z.record(z.string(), z.unknown()).optional(),
      styles: z.record(z.string(), z.unknown()).optional(),
      runtime: z.enum(['server', 'client', 'shared']).optional()
    },
    async ({ spaceId, environment, elementId, label, props, styles, runtime }) => {
      const element = await adapters.updateElement(spaceId, environment, elementId, { label, props, styles, runtime });
      return ok(element);
    }
  );

  server.tool(
    'delete_element',
    'Remove an element and all its descendants from the schema',
    { spaceId: z.number(), environment: z.string(), elementId: z.string() },
    async ({ spaceId, environment, elementId }) => {
      await adapters.deleteElement(spaceId, environment, elementId);
      return ok({ deleted: elementId });
    }
  );

  server.tool(
    'publish_schema',
    'Publish the current draft schema as a new immutable revision',
    { spaceId: z.number(), environment: z.string() },
    async ({ spaceId, environment }) => {
      const result = await adapters.publishSchema(spaceId, environment);
      return ok(result);
    }
  );

  if (adapters.listPlugins) {
    const listPlugins = adapters.listPlugins;
    server.tool('list_plugins', 'List all plugins registered in the system', {}, async () => {
      const plugins = await listPlugins();
      return ok(plugins);
    });
  }

  return server;
};
