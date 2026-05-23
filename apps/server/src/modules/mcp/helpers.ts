import { z } from 'zod';

import type {
  AiContext,
  AiMode,
  McpAdapter,
  McpToolHandler,
  McpToolHandlerResult,
  ToolOperationType
} from '@plitzi/sdk-shared';

export const zodToJsonSchema = (schema: unknown): Record<string, unknown> => {
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

export const getAllowedModes = (operationType: ToolOperationType): AiMode[] => {
  return operationType === 'write' ? ['build'] : ['plan', 'build'];
};

export const toolResponseOk = (data: unknown, useStructuredContent = false): McpToolHandlerResult => {
  const isStructured = useStructuredContent && typeof data === 'object' && data !== null && !Array.isArray(data);
  if (isStructured) {
    return { content: [], structuredContent: data as Record<string, unknown> };
  }

  return { content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }] };
};

export const toolResponseErr = (error: Error | string): McpToolHandlerResult => ({
  content: [{ type: 'text' as const, text: error instanceof Error ? error.message : error }],
  isError: true as const
});

export const adapterWrapper = (
  adapterName: string,
  handler?: McpAdapter,
  useStructuredContent = false
): McpToolHandler => {
  return async (args: Record<string, unknown>, ctx: AiContext) => {
    if (!handler) {
      return toolResponseErr(`Adapter ${adapterName} not found`);
    }

    const result = await handler(args, ctx);
    if ('error' in result) {
      return toolResponseErr(result.error);
    }

    return toolResponseOk(result.data, useStructuredContent);
  };
};
