import { z } from 'zod';

import * as tools from './tools';

import type { AiMode, McpToolDefinition, ToolOperationType } from '@plitzi/sdk-shared';

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
  const tool = tools[name];

  const {
    name: toolName,
    description,
    operationType,
    inputSchema
  } = tool as {
    name: string;
    description: string;
    operationType: ToolOperationType;
    inputSchema: z.ZodObject;
  };

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
  const definitions: McpToolDefinition[] = [];
  for (const toolName of Object.keys(tools)) {
    definitions.push(getToolDefinition(toolName as keyof typeof tools));
  }

  return mode ? definitions.filter(definition => definition.allowedModes.includes(mode)) : definitions;
};

export const toolDefinitions = getToolDefinitions();
