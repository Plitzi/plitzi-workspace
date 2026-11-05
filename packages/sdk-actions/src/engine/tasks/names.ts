import { builtinTasks } from './builtins';
import { dbTasks } from './db';

import type { ActionTask } from '../types';

const NAME_PATTERN = /^[a-z][a-zA-Z0-9]*$/;

export const taskName = (task: Pick<ActionTask, 'namespace' | 'action'>): string => `${task.namespace}.${task.action}`;

/** The namespaces the platform's own tasks use: nobody else's task may take one. */
const RESERVED_NAMESPACES: ReadonlySet<string> = new Set([...builtinTasks, ...dbTasks].map(task => task.namespace));

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
