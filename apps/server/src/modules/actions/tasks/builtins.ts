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
 * Anything needing an account somewhere — email, AI, object storage — is the DEPLOYMENT's, registered through
 * `actions.tasks`. A server with no mail transport must not offer a step whose only possible outcome is failure.
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
