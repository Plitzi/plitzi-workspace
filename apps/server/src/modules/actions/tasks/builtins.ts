import { authTasks } from './auth';
import { connectorTasks } from './connector';
import { flowTasks, streamTasks } from './flow';
import { httpTasks } from './http';
import { kvTasks } from './kv';
import { transformTasks } from './transform';

import type { ActionTask } from '../types';

/**
 * The tasks `sdk-server` itself ships: the ones that are mechanism rather than policy.
 *
 * Anything needing an account somewhere — AI, object storage — is the DEPLOYMENT's, registered through
 * `actions.tasks`. `db.query` and `email.send` sit in between: the task is shipped because its rules are the same
 * everywhere, the driver or transport is the deployment's, and the registry offers the task only when one was given.
 */
export const builtinTasks: ActionTask<Record<string, unknown>>[] = [
  ...flowTasks,
  ...transformTasks,
  ...httpTasks,
  ...connectorTasks,
  ...authTasks,
  ...kvTasks,
  ...streamTasks
];
