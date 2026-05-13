/* eslint-disable @typescript-eslint/no-explicit-any */

import type { McpAdapters, McpContext, ToolOperationType } from '@plitzi/sdk-shared';
import type { z } from 'zod';

const ok = (data: unknown) => ({ content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }] });
const err = (message: string) => ({ content: [{ type: 'text' as const, text: message }], isError: true as const });

export const createTool = <T extends keyof McpAdapters>(
  name: string,
  description: string,
  inputSchema: z.ZodObject,
  operationType: ToolOperationType,
  executeFn: (args: Parameters<McpAdapters[T]>[0], adapters?: Partial<McpAdapters>, ctx?: McpContext) => unknown
) => {
  return (adapters?: Partial<McpAdapters>, ctx?: McpContext) => ({
    name,
    description,
    operationType,
    inputSchema,
    execute: async (args: Record<string, unknown>) => {
      try {
        const result = await executeFn(args, adapters, ctx);

        return ok(result);
      } catch (e) {
        return err(e instanceof Error ? e.message : String(e));
      }
    }
  });
};

export const callAdapter = <T extends keyof McpAdapters>(
  adapterName: T,
  args: Parameters<McpAdapters[T]>[0],
  adapters?: Partial<McpAdapters>,
  ctx?: McpContext
): ReturnType<McpAdapters[T]> => {
  const adapter = adapters?.[adapterName];
  if (!adapter) {
    throw new Error(`Adapter ${adapterName} not available`);
  }

  // eslint-disable-next-line @typescript-eslint/no-unsafe-call
  return (adapter as any)(args, ctx) as ReturnType<McpAdapters[T]>;
};
