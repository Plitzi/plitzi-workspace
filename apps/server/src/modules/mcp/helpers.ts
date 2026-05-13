import { z } from 'zod';

import * as tools from './tools';

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp';
import type {
  AiMode,
  McpAdapters,
  McpContext,
  McpToolDefinition,
  McpToolLifecycleHooks,
  ToolOperationType
} from '@plitzi/sdk-shared';

export const wrapHandler = <
  T extends (args: Record<string, unknown>, ctx: McpContext, hooks?: McpToolLifecycleHooks) => unknown
>(
  handler: T,
  ctx: McpContext
) => {
  return (args: Record<string, unknown>) => handler(args, ctx) as ReturnType<T>;
};

export const registerBuiltInTools = (
  server: McpServer,
  adapters: Partial<McpAdapters>,
  ctx: McpContext,
  hooks?: McpToolLifecycleHooks
): void => {
  for (const toolFn of Object.values(tools)) {
    const { name, description, inputSchema, execute } = toolFn(adapters, ctx, hooks);
    server.registerTool(name, { description, inputSchema }, execute);
  }
};

const zodToJsonSchema = (schema: unknown): Record<string, unknown> => {
  if (schema instanceof z.ZodObject) {
    const properties: Record<string, unknown> = {};
    const required: string[] = [];

    for (const [key, value] of Object.entries(schema.shape)) {
      const propSchema = zodToJsonSchema(value as z.ZodTypeAny);
      properties[key] = propSchema;

      if (value instanceof z.ZodString || value instanceof z.ZodNumber || value instanceof z.ZodBoolean) {
        if (!value.isOptional()) {
          required.push(key);
        }
      }
    }

    return {
      type: 'object',
      properties,
      required: required.length > 0 ? required : []
    };
  }

  if (schema instanceof z.ZodString) {
    return { type: 'string' };
  }

  if (schema instanceof z.ZodNumber) {
    return { type: 'number' };
  }

  if (schema instanceof z.ZodBoolean) {
    return { type: 'boolean' };
  }

  if (schema instanceof z.ZodEnum) {
    return { type: 'string', enum: schema.options };
  }

  if (schema instanceof z.ZodOptional) {
    return zodToJsonSchema((schema as unknown as { _def: { innerType: z.ZodTypeAny } })._def.innerType);
  }

  if (schema instanceof z.ZodUnion) {
    return { oneOf: schema.options.map(opt => zodToJsonSchema(opt)) };
  }

  if (schema instanceof z.ZodArray) {
    return {
      type: 'array',
      items: zodToJsonSchema(schema.element)
    };
  }

  if (schema instanceof z.ZodRecord) {
    return {
      type: 'object',
      additionalProperties: zodToJsonSchema(schema.valueType)
    };
  }

  return {};
};

const getAllowedModes = (operationType: ToolOperationType): AiMode[] => {
  if (operationType === 'write' || operationType === 'admin') {
    return ['build'];
  }

  return ['plan', 'build'];
};

export const getToolDefinition = (name: keyof typeof tools) => {
  const toolFn = tools[name];
  if (!(toolFn as typeof toolFn | undefined)) {
    return undefined;
  }

  const definition = toolFn();
  if (!(definition as typeof definition | undefined)) {
    return undefined;
  }

  const { name: toolName, description, operationType, inputSchema } = definition;

  return {
    name: toolName.replace(/_/g, '_'),
    shortDescription: description.split('.')[0],
    description,
    parameters: zodToJsonSchema(inputSchema),
    allowedModes: getAllowedModes(operationType),
    operationType
  };
};

export const getToolDefinitions = (mode?: AiMode): McpToolDefinition[] => {
  let definitions: McpToolDefinition[] = [];
  for (const toolName of Object.keys(tools)) {
    const definition = getToolDefinition(toolName as keyof typeof tools);
    if (definition) {
      definitions.push(definition);
    }
  }

  if (mode) {
    definitions = definitions.filter(definition => definition.allowedModes.includes(mode));
  }

  return definitions;
};

export const toolDefinitions = getToolDefinitions();
