import { toolResponseErr } from '../mcp-legacy/helpers';

import type {
  AiMode,
  AiContext,
  McpPromptHandler,
  McpToolHandler,
  McpToolLifecycleHooks,
  StreamCallbacks,
  McpTool,
  McpToolHandlerResult
} from '@plitzi/sdk-shared';

class AIEngine implements McpToolLifecycleHooks {
  private toolsAvailables = new Map<string, McpTool>();
  private toolsAvailablesMap = new Map<string, AiMode[]>();
  public ctx: AiContext;

  constructor(
    private readonly mode: AiMode | undefined,
    public readonly callbacks: StreamCallbacks,
    ctx: Omit<AiContext, 'mode'>
  ) {
    this.ctx = { ...ctx, mode: mode || 'plan' };
  }

  readonly readResource = (name: string, uri: string): void => {
    this.callbacks.onResourceRead?.(name, uri);
  };

  readonly setToolsAvailables = (tools: McpTool[]) => {
    this.toolsAvailables = new Map(tools.map(t => [t.name, t]));
    this.toolsAvailablesMap = new Map(tools.map(t => [t.name, t.definition.allowedModes]));
  };

  readonly can = (name: string): boolean => {
    if (!this.mode || !this.toolsAvailablesMap.has(name)) {
      return false;
    }

    const allowedModes = this.toolsAvailablesMap.get(name);

    return !allowedModes || allowedModes.includes(this.mode);
  };

  readonly before = async (name: string, args: Record<string, unknown>): Promise<boolean> => {
    this.callbacks.onBeforeTool?.(name, args);

    if (!this.toolsAvailables.has(name)) {
      this.callbacks.onLog?.('error', `tool rejected: '${name}' has no definition — possible security violation`);
      await this.after(name, args, toolResponseErr(`Tool '${name}' is not defined and cannot be executed`));

      return false;
    }

    if (!this.can(name)) {
      this.callbacks.onLog?.('info', `tool blocked: '${name}' is not permitted in ${this.mode} mode`);
      await this.after(name, args, toolResponseErr(`Tool '${name}' is not permitted in ${this.mode} mode`));

      return false;
    }

    return true;
  };

  readonly after = (name: string, args: Record<string, unknown>, result: McpToolHandlerResult): Promise<void> => {
    let resultParsed: unknown;

    if (result.data !== undefined) {
      resultParsed = result.data;
    } else {
      try {
        resultParsed = JSON.parse(result.content[0]?.text ?? '');
      } catch {
        // ignore
      }
    }

    if (result.isError) {
      this.callbacks.onToolError?.({
        name,
        args,
        result: resultParsed ?? { error: result.content[0]?.text ?? 'Tool failed' }
      });
    } else {
      this.callbacks.onToolSuccess?.({ name, args, result: resultParsed });
    }

    return Promise.resolve();
  };

  private readonly validateToolInput = (
    name: string,
    args: Record<string, unknown>
  ): { success: true; data: Record<string, unknown> } | { success: false; error: string } => {
    const tool = this.toolsAvailables.get(name);
    if (!tool || !tool.mcpDefinition.inputSchema) {
      return { success: true, data: args };
    }

    const parsed = tool.mcpDefinition.inputSchema.safeParse(args);
    if (!parsed.success) {
      return { success: false, error: parsed.error.message };
    }

    return { success: true, data: parsed.data as Record<string, unknown> };
  };

  private readonly validateToolOutput = (name: string, result: McpToolHandlerResult): string | undefined => {
    const tool = this.toolsAvailables.get(name);
    if (!tool || !tool.mcpDefinition.outputSchema || result.isError) {
      return undefined;
    }

    // A successful "not found" / empty result (undefined) is valid — adapters signal real
    // failures via the { error } branch, which surfaces as result.isError above.
    if (result.data === undefined) {
      return undefined;
    }

    const parsed = tool.mcpDefinition.outputSchema.safeParse(result.data);
    if (!parsed.success) {
      return parsed.error.message;
    }

    return undefined;
  };

  private readonly runPipeline = async (
    name: string,
    args: Record<string, unknown>,
    handler: McpToolHandler
  ): Promise<McpToolHandlerResult> => {
    const parsedArgs = this.validateToolInput(name, args);
    if (!parsedArgs.success) {
      this.callbacks.onLog?.('error', `tool validation error: ${name} error=${parsedArgs.error}`);
      const err = toolResponseErr(parsedArgs.error);
      await this.after(name, args, err);

      return err;
    }

    const t0 = Date.now();
    const result = await handler(parsedArgs.data, this.ctx);
    this.callbacks.onLog?.(
      'debug',
      `tool done: ${name} ms=${Date.now() - t0} result=${JSON.stringify(result).slice(0, 200)}`
    );

    // Output validation is advisory: the adapter's real data is the source of truth, so schema drift
    // is logged for developers to tighten the schema but never denies the model the result.
    const outputError = this.validateToolOutput(name, result);
    if (outputError) {
      this.callbacks.onLog?.('info', `tool output schema drift: ${name} — ${outputError}`);
    }

    const tool = this.toolsAvailables.get(name);
    if (!result.isError && tool?.mcpDefinition.outputSchema && result.data !== undefined && result.data !== null) {
      // structuredContent must be a JSON object per the MCP spec, so arrays and primitives are
      // wrapped in { data } — otherwise external clients (MCP Inspector) reject the result.
      result.structuredContent =
        typeof result.data === 'object' && !Array.isArray(result.data)
          ? (result.data as Record<string, unknown>)
          : { data: result.data };
    }

    if (result.isError) {
      this.callbacks.onLog?.('error', `tool failed: ${name} error=${result.content[0]?.text ?? 'unknown'}`);
    }

    await this.after(name, args, result);

    return result;
  };

  readonly execute =
    (name: string, handlerFn?: McpToolHandler) =>
    async (args: Record<string, unknown>): Promise<McpToolHandlerResult> => {
      const allowed = await this.before(name, args);
      if (!allowed) {
        return toolResponseErr(`Tool '${name}' execution was blocked`);
      }

      const handler = handlerFn ?? this.toolsAvailables.get(name)?.handler;
      if (!handler) {
        this.callbacks.onLog?.('error', `no handler registered for tool: ${name}`);
        const err = toolResponseErr(`Tool '${name}' has no handler`);
        await this.after(name, args, err);

        return err;
      }

      this.callbacks.onLog?.('debug', `tool exec: ${name} args=${JSON.stringify(args).slice(0, 200)}`);

      return this.runPipeline(name, args, handler);
    };

  readonly executePrompt = (_name: string, handlerFn: McpPromptHandler) => async (args: Record<string, unknown>) => {
    return handlerFn(args, this.ctx);
  };
}

export default AIEngine;
