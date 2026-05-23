import { z } from 'zod';

import type { AiContext, AiMode, McpAdapter, McpToolHandler, ToolOperationType } from '@plitzi/sdk-shared';

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
  return operationType === 'read' ? ['plan'] : ['plan', 'build'];
};

export const toolResponseOk = (data: unknown) => ({
  content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }]
});

export const toolResponseErr = (error: Error | string) => ({
  content: [{ type: 'text' as const, text: error instanceof Error ? error.message : error }],
  isError: true as const
});

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const adapterWrapper = (adapterName: string, handler?: McpAdapter<any, any>): McpToolHandler => {
  return async (args: Record<string, unknown>, ctx: AiContext) => {
    if (!handler) {
      return toolResponseErr(`Adapter ${adapterName} not found`);
    }

    const result = await handler(args, ctx);
    if ('error' in result) {
      return toolResponseErr(result.error);
    }

    return toolResponseOk(result.data);
  };
};
