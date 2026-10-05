import { functionContextFor } from './context';

import type { FunctionContext, FunctionsDefinition, FunctionTask } from './contract';
import type { FunctionScope } from './scope';
import type { ActionTask, ActionTaskContext } from '../actions/types';

/**
 * A server's own functions, loaded as they are: trusted code the deployment ships — a self-hosted server's, or a
 * platform's own — run in the process with the run's context narrowed to what a function may see. The same code a
 * space runs in the sandbox, loaded without one.
 */
export const nativeTasks = (
  definitions: readonly FunctionsDefinition[] = [],
  scope?: FunctionScope
): ActionTask<Record<string, unknown>>[] =>
  definitions.flatMap(definition =>
    (definition.tasks ?? []).map(task => {
      const contextFor = (ctx: ActionTaskContext): FunctionContext =>
        functionContextFor(ctx, definition.allow?.hosts ?? [], scope);
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
        run: (values, ctx): unknown => run(values, contextFor(ctx))
      };
    })
  );
