import { toolResponseErr } from '../mcp/helpers';
import * as defaultTools from '../mcp/tools';

import type {
  AiMode,
  AiContext,
  McpPromptHandler,
  McpToolHandler,
  McpToolLifecycleHooks,
  StreamCallbacks,
  McpTool,
  McpAdapters,
  McpToolHandlerResult
} from '@plitzi/sdk-shared';

class AIEngine implements McpToolLifecycleHooks {
  private toolsAvailables = new Map<string, McpTool>();
  private toolsAvailablesMap = new Map<string, AiMode[]>();
  public ctx: AiContext;

  constructor(
    private readonly mode: AiMode | undefined,
    private readonly mcpAdapters: Partial<McpAdapters> | undefined,
    public readonly callbacks: StreamCallbacks,
    ctx: Omit<AiContext, 'mode'>
  ) {
    this.ctx = { ...ctx, mode: mode || 'plan' };
  }

  readonly setToolsAvailables = (tools: McpTool[]) => {
    this.toolsAvailables = new Map([...Object.values(defaultTools), ...tools].map(t => [t.name, t]));
    this.toolsAvailablesMap = new Map(
      [...Object.values(defaultTools), ...tools].map(t => [t.name, t.definition.allowedModes])
    );
  };

  readonly can = (name: string): boolean => {
    if (!this.mode || !this.toolsAvailablesMap.has(name)) {
      return false;
    }

    const allowedModes = this.toolsAvailablesMap.get(name);

    return !allowedModes || allowedModes.includes(this.mode);
  };

  readonly before = (name: string, args: Record<string, unknown>): boolean => {
    this.callbacks.onToolStart?.(name, args);

    return true;
  };

  readonly after = (name: string, args: Record<string, unknown>, result: McpToolHandlerResult): Promise<void> => {
    let resultParsed: unknown = undefined;

    try {
      resultParsed = result.structuredContent || JSON.parse(result.content[0]?.text);
    } catch {
      // Nothing to do
    }

    this.callbacks.onToolCall?.({ name, args, result: resultParsed });

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

    if (!result.structuredContent) {
      return `Tool '${name}' has an output schema but no structured content was provided`;
    }

    const parsed = tool.mcpDefinition.outputSchema.safeParse(result.structuredContent);
    if (!parsed.success) {
      return parsed.error.message;
    }

    return undefined;
  };

  readonly execute = (name: string) => async (args: Record<string, unknown>) => {
    if (!this.toolsAvailables.has(name)) {
      this.callbacks.onLog?.('error', `tool rejected: '${name}' has no definition — possible security violation`);

      return { error: `Tool '${name}' is not defined and cannot be executed` };
    }

    if (!this.can(name)) {
      this.callbacks.onLog?.('info', `tool blocked: '${name}' is not permitted in ${this.mode} mode`);

      return { error: `Tool '${name}' is not permitted in ${this.mode} mode` };
    }

    if (!this.before(name, args)) {
      return { error: `Tool '${name}' execution was cancelled` };
    }

    const tool = this.toolsAvailables.get(name);
    if (!tool) {
      this.callbacks.onLog?.('error', `unknown tool: ${name}`);

      return toolResponseErr(`Unknown tool: ${name}`);
    }

    const handler =
      'adapterName' in tool && tool.adapterName
        ? (this.mcpAdapters?.[tool.adapterName] as unknown as McpToolHandler | undefined)
        : tool.handler;
    if (!handler) {
      this.callbacks.onLog?.('error', `unknown tool: ${name}`);

      return toolResponseErr(`Unknown tool: ${name}`);
    }

    this.callbacks.onLog?.('debug', `tool exec: ${name} args=${JSON.stringify(args).slice(0, 200)}`);

    const parsedArgs = this.validateToolInput(name, args);
    if (!parsedArgs.success) {
      this.callbacks.onLog?.('error', `tool validation error: ${name} error=${parsedArgs.error}`);
      await this.after(name, args, toolResponseErr(parsedArgs.error));

      return toolResponseErr(parsedArgs.error);
    }

    const t0 = Date.now();
    const result = await handler(parsedArgs.data, this.ctx);
    this.callbacks.onLog?.(
      'debug',
      `tool done: ${name} ms=${Date.now() - t0} result=${JSON.stringify(result).slice(0, 200)}`
    );

    const outputError = this.validateToolOutput(name, result);
    if (outputError) {
      this.callbacks.onLog?.('error', `tool output validation error: ${name} error=${outputError}`);
      await this.after(name, args, toolResponseErr(outputError));

      return toolResponseErr(outputError);
    }

    if (result.isError) {
      this.callbacks.onLog?.('error', `tool failed: ${name} error=${result.content[0]?.text ?? 'unknown'}`);
    }

    await this.after(name, args, result);

    return result;
  };

  readonly executeTool = (name: string, handlerFn: McpToolHandler) => async (args: Record<string, unknown>) => {
    if (!this.toolsAvailables.has(name)) {
      this.callbacks.onLog?.('error', `tool rejected: '${name}' has no definition — possible security violation`);

      return toolResponseErr(`Tool '${name}' is not defined and cannot be executed`);
    }

    if (!this.can(name)) {
      this.callbacks.onLog?.('info', `tool blocked: '${name}' is not permitted in ${this.mode} mode`);

      return toolResponseErr(`Tool '${name}' is not permitted in ${this.mode} mode`);
    }

    if (!this.before(name, args)) {
      return toolResponseErr(`Tool '${name}' execution was cancelled`);
    }

    this.callbacks.onLog?.('debug', `tool exec: ${name} args=${JSON.stringify(args).slice(0, 200)}`);

    const parsedArgs = this.validateToolInput(name, args);
    if (!parsedArgs.success) {
      this.callbacks.onLog?.('error', `tool validation error: ${name} error=${parsedArgs.error}`);
      await this.after(name, args, toolResponseErr(parsedArgs.error));

      return toolResponseErr(parsedArgs.error);
    }

    const t0 = Date.now();
    const result = await handlerFn(parsedArgs.data, this.ctx);
    this.callbacks.onLog?.(
      'debug',
      `tool done: ${name} ms=${Date.now() - t0} result=${JSON.stringify(result).slice(0, 200)}`
    );

    const outputError = this.validateToolOutput(name, result);
    if (outputError) {
      this.callbacks.onLog?.('error', `tool output validation error: ${name} error=${outputError}`);
      await this.after(name, args, toolResponseErr(outputError));

      return toolResponseErr(outputError);
    }

    if (result.isError) {
      this.callbacks.onLog?.('error', `tool failed: ${name} error=${result.content[0]?.text ?? 'unknown'}`);
    }

    await this.after(name, args, result);

    return result;
  };

  readonly executePrompt = (_name: string, handlerFn: McpPromptHandler) => async (args: Record<string, unknown>) => {
    return handlerFn(args, this.ctx);
  };
}

export default AIEngine;
