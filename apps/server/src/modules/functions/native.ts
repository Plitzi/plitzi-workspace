import { DEFAULT_FUNCTION_LIMITS } from './config';
import { functionContextFor } from './context';
import { jobsManifestOf } from './jobs';
import { serverLog } from '../../helpers/serverLog';

import type { FunctionContext, FunctionsDefinition, FunctionTask } from './contract';
import type { FunctionLimits } from './protocol';
import type { FunctionScope } from './scope';
import type { ActionTask, ActionTaskContext } from '../actions/types';

/**
 * A server's own functions, loaded as they are: trusted code the deployment ships — a self-hosted server's, or a
 * platform's own — run in the process with the run's context narrowed to what a function may see. The same code a
 * space runs in the sandbox, loaded without one.
 */
/**
 * A context that counts what it is asked: every call to `ctx`, a namespace's included (`ctx.kv.get`) — what a sandbox
 * counts as a call to the platform.
 */
const counted = <T extends object>(target: T, count: { calls: number }): T =>
  new Proxy(target, {
    get: (object, key, receiver) => {
      const value: unknown = Reflect.get(object, key, receiver);
      if (typeof value === 'function') {
        return (...args: unknown[]): unknown => {
          count.calls += 1;

          return Reflect.apply(value, object, args);
        };
      }

      return typeof value === 'object' && value !== null ? counted(value, count) : value;
    }
  });

const byteLength = (value: unknown): number => {
  try {
    return value === undefined ? 0 : Buffer.byteLength(JSON.stringify(value));
  } catch {
    return 0;
  }
};

/** One limit a native invocation went past, said once per task: it runs again and again with the same code. */
const said = new Set<string>();

const sayOver = (task: string, usage: Partial<FunctionLimits>, limits: FunctionLimits): void => {
  const over = (
    [
      ['calls', 'calls to the platform', 'Made more than the {limit} calls to the platform it may'],
      ['cpuMs', 'ms of CPU', 'Stopped after {limit} ms of CPU'],
      ['wallMs', 'ms', 'Stopped after {limit} ms'],
      ['outputBytes', 'bytes of answer', 'Answered more than {limit} bytes']
    ] as const
  ).filter(([limit]) => (usage[limit] ?? 0) > limits[limit] && !said.has(`${task}|${limit}`));
  for (const [limit, unit, refusal] of over) {
    said.add(`${task}|${limit}`);
    serverLog.warn(
      'Functions',
      `${task} spent ${String(Math.round(usage[limit] ?? 0))} ${unit}, and a sandbox stops one at ${String(limits[limit])} (\`${limit}\`): ` +
        `hosted, this run fails with "${refusal.replace('{limit}', String(limits[limit]))}". It runs here natively, held to nothing. ` +
        "Ask for more with the task's `limits` (CPU and time), spend less, or see what the server hosting the space gives with `plitzi doctor`."
    );
  }
};

/**
 * A task run natively, measured as a sandbox would hold it: the calls it makes to `ctx`, its time, its CPU (the
 * process's, so a rough measure when others run beside it) and the bytes it answers. Said, never enforced.
 */
const measured =
  (name: string, limits: FunctionLimits, run: (ctx: FunctionContext) => unknown) =>
  async (ctx: FunctionContext): Promise<unknown> => {
    const count = { calls: 0 };
    const startedAt = performance.now();
    const cpuAt = process.cpuUsage();
    try {
      const result = await run(counted(ctx, count));
      const cpu = process.cpuUsage(cpuAt);
      sayOver(
        name,
        {
          calls: count.calls,
          wallMs: performance.now() - startedAt,
          cpuMs: (cpu.user + cpu.system) / 1000,
          outputBytes: byteLength(result)
        },
        limits
      );

      return result;
    } catch (error) {
      sayOver(name, { calls: count.calls, wallMs: performance.now() - startedAt }, limits);
      throw error;
    }
  };

export type NativeTasksOptions = {
  scope?: FunctionScope;
  /**
   * Measure each invocation against what a sandbox holds one to — its defaults, with the CPU and time the functions and
   * the task ask for — and say the first one past each limit: what a project's own server does, whose code is the code
   * a hosted space runs in one.
   */
  measure?: boolean;
};

export const nativeTasks = (
  definitions: readonly FunctionsDefinition[] = [],
  { scope, measure = false }: NativeTasksOptions = {}
): ActionTask<Record<string, unknown>>[] =>
  definitions.flatMap(definition =>
    (definition.tasks ?? []).map(task => {
      const contextFor = (ctx: ActionTaskContext): FunctionContext =>
        functionContextFor(ctx, definition.allow?.hosts ?? [], scope, definition.oauth, jobsManifestOf(definition));
      // A catalog is heterogeneous by nature — each task declares its own params, and `FunctionTask<never>` is how a
      // list of them is typed — so the one call into it is widened here, where the params were already resolved
      // against the task's own declaration.
      const { run, params } = task as FunctionTask<Record<string, unknown>>;

      return {
        namespace: task.namespace,
        action: task.action,
        title: task.title,
        ...(task.description ? { description: task.description } : {}),
        params,
        run: measure
          ? (values, ctx): unknown =>
              measured(
                `${task.namespace}.${task.action}`,
                { ...DEFAULT_FUNCTION_LIMITS, ...definition.limits, ...task.limits },
                context => run(values, context)
              )(contextFor(ctx))
          : (values, ctx): unknown => run(values, contextFor(ctx))
      };
    })
  );
