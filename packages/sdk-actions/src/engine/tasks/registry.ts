import { builtinTasks } from './builtins';
import { dbTasks } from './db';
import { taskName, taskNameProblem } from './names';
import { nativeTasks } from '../../functions/native';
import { pluginTaskProblem } from '../../functions/scope';

import type { ActionTaskRegistry, RegisteredTask } from '../types';
import type { FunctionsDefinition } from '@plitzi/sdk-shared/functions';

/** The shipped tasks that are only real when the deployment supplied what they run through. */
export type TaskRegistryOptions = {
  /** At least one database driver is registered, so `db.query` has an engine to run against. */
  db?: boolean;
  /** The server halves of the plugins this server ships, by plugin type: their tasks are `<type>.<action>`. */
  plugins?: Readonly<Record<string, FunctionsDefinition>>;
  /** Measure the native functions' invocations against a sandbox's limits, and say one past them (`nativeTasks`). */
  measureNative?: boolean;
};

/**
 * Builds the set of tasks this server can run.
 *
 * Validation is at BOOT and it throws, because every alternative is worse: a task registered under a malformed
 * name is unreachable from any document, and one shadowing a built-in silently changes what every existing action
 * in that deployment does. Both are invisible until a run misbehaves in production.
 */
export const createTaskRegistry = (
  functions: readonly FunctionsDefinition[] = [],
  { db = false, plugins = {}, measureNative = false }: TaskRegistryOptions = {}
): ActionTaskRegistry => {
  const tasks = new Map<string, RegisteredTask>();

  // `db.query` is only real when this deployment registered an engine to run it against. Offering it otherwise would
  // put a step in the editor whose only possible outcome is "this server has no driver".
  const shipped = db ? [...builtinTasks, ...dbTasks] : builtinTasks;
  shipped.forEach(task => tasks.set(taskName(task), { ...task, name: taskName(task), origin: 'deployment' }));

  nativeTasks(functions, { measure: measureNative }).forEach(task => {
    const problem = taskNameProblem(task);
    if (problem) {
      throw new Error(`[Actions] ${problem}`);
    }

    const name = taskName(task);
    if (tasks.has(name)) {
      throw new Error(`[Actions] Task "${name}" is registered twice`);
    }

    tasks.set(name, { ...task, name, origin: 'deployment' });
  });

  // A plugin's tasks are named after it, so no two plugins — and no plugin and the deployment — claim one name.
  Object.entries(plugins).forEach(([plugin, definition]) => {
    nativeTasks([definition], { scope: { plugin } }).forEach(task => {
      const problem =
        taskNameProblem(task) ??
        (task.namespace === plugin ? undefined : pluginTaskProblem(plugin, task.namespace, task.action));
      if (problem) {
        throw new Error(`[Actions] ${problem}`);
      }

      const name = taskName(task);
      if (tasks.has(name)) {
        throw new Error(`[Actions] Task "${name}" is registered twice`);
      }

      tasks.set(name, { ...task, name, origin: 'plugin' });
    });
  });

  return {
    get: name => tasks.get(name),
    list: () => [...tasks.values()]
  };
};
