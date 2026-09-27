import { builtinTasks } from './builtins';
import { dbTasks } from './db';
import { nativeTasks } from '../../functions/native';

import type { FunctionsDefinition } from '../../functions/contract';
import type { ActionTask, ActionTaskRegistry, RegisteredTask } from '../types';

const NAME_PATTERN = /^[a-z][a-zA-Z0-9]*$/;

export const taskName = (task: Pick<ActionTask, 'namespace' | 'action'>): string => `${task.namespace}.${task.action}`;

/** The namespaces the platform's own tasks use: nobody else's task may take one. */
export const RESERVED_NAMESPACES: ReadonlySet<string> = new Set(
  [...builtinTasks, ...dbTasks].map(task => task.namespace)
);

/**
 * What is wrong with a task's name, or nothing — one rule for a deployment's tasks at boot and a space's own when its
 * functions are built. A malformed name is unreachable from any document; one in a namespace taken by another task
 * set silently changes what every action using that set does.
 */
export const taskNameProblem = (
  task: Pick<ActionTask, 'namespace' | 'action'>,
  reserved: ReadonlySet<string> = RESERVED_NAMESPACES
): string | undefined => {
  if (!NAME_PATTERN.test(task.namespace) || !NAME_PATTERN.test(task.action)) {
    return `Invalid task name "${taskName(task)}": expected camelCase namespace and action`;
  }

  if (reserved.has(task.namespace)) {
    return `Namespace "${task.namespace}" is reserved by another task set`;
  }

  return undefined;
};

/** The shipped tasks that are only real when the deployment supplied what they run through. */
export type TaskRegistryOptions = {
  /** At least one database driver is registered, so `db.query` has an engine to run against. */
  db?: boolean;
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
  { db = false }: TaskRegistryOptions = {}
): ActionTaskRegistry => {
  const tasks = new Map<string, RegisteredTask>();

  // `db.query` is only real when this deployment registered an engine to run it against. Offering it otherwise would
  // put a step in the editor whose only possible outcome is "this server has no driver".
  const shipped = db ? [...builtinTasks, ...dbTasks] : builtinTasks;
  shipped.forEach(task => tasks.set(taskName(task), { ...task, name: taskName(task) }));

  nativeTasks(functions).forEach(task => {
    const problem = taskNameProblem(task);
    if (problem) {
      throw new Error(`[Actions] ${problem}`);
    }

    const name = taskName(task);
    if (tasks.has(name)) {
      throw new Error(`[Actions] Task "${name}" is registered twice`);
    }

    tasks.set(name, { ...task, name });
  });

  return {
    get: name => tasks.get(name),
    list: () => [...tasks.values()]
  };
};
