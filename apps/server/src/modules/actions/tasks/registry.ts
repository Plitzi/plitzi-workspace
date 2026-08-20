import { builtinTasks } from './builtins';

import type { ActionTask, ActionTaskRegistry, RegisteredTask } from '../types';

const NAME_PATTERN = /^[a-z][a-zA-Z0-9]*$/;

export const taskName = (task: Pick<ActionTask, 'namespace' | 'action'>): string => `${task.namespace}.${task.action}`;

const reservedNamespaces = new Set(builtinTasks.map(task => task.namespace));

/**
 * Builds the set of tasks this server can run.
 *
 * Validation is at BOOT and it throws, because every alternative is worse: a task registered under a malformed
 * name is unreachable from any document, and one shadowing a built-in silently changes what every existing action
 * in that deployment does. Both are invisible until a run misbehaves in production.
 */
export const createTaskRegistry = (custom: ActionTask<never>[] = []): ActionTaskRegistry => {
  const tasks = new Map<string, RegisteredTask>();

  builtinTasks.forEach(task => tasks.set(taskName(task), { ...task, name: taskName(task) }));

  (custom as ActionTask<Record<string, unknown>>[]).forEach(task => {
    if (!NAME_PATTERN.test(task.namespace) || !NAME_PATTERN.test(task.action)) {
      throw new Error(`[Actions] Invalid task name "${taskName(task)}": expected camelCase namespace and action`);
    }

    if (reservedNamespaces.has(task.namespace)) {
      throw new Error(`[Actions] Namespace "${task.namespace}" is reserved by a built-in task set`);
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
