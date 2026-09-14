import { authTasks } from './auth';
import { connectorTasks } from './connector';
import { emailTasks } from './email';
import { flowTasks, streamTasks } from './flow';
import { httpTasks } from './http';
import { kvTasks } from './kv';
import { transformTasks } from './transform';

import type { ActionTask } from '../types';

/**
 * The tasks `sdk-server` itself ships: the ones that are mechanism rather than policy.
 *
 * Anything needing an account somewhere the deployment owns — AI, object storage — is the DEPLOYMENT's, registered
 * through `actions.tasks`. `email.send` is shipped because the account is the SPACE's: it sends through an SMTP server
 * the space holds as a credential, so every server can offer it. `db.query` sits in between — the task is shipped,
 * the engine driver is the deployment's, and the registry offers it only when one was given.
 */
export const builtinTasks: ActionTask<Record<string, unknown>>[] = [
  ...flowTasks,
  ...transformTasks,
  ...httpTasks,
  ...connectorTasks,
  ...authTasks,
  ...kvTasks,
  ...emailTasks,
  ...streamTasks
];
