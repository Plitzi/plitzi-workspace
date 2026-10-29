import { ActionRunError } from './errors';
import { namespaceKv } from './namespaceKv';
import { projectDataReader } from './projectData';
import { cappedResponse } from '../../../helpers/outboundGuard';
import { laterFor } from '../jobs/later';

import type { createEmailSender } from './email';
import type { createRedactor } from './scope';
import type { createSigning } from './signing';
import type { FunctionJobsService } from '../../functions/jobs';
import type { LaterDeps } from '../jobs/later';
import type { ActionKvStore, ActionRunRequest, ActionsConfig, ActionTaskContext, ResolvedActionLimits } from '../types';
import type { RunUser } from '@plitzi/sdk-shared';

/**
 * Counts outbound calls, refuses past the budget, caps what one answer may carry back, and stamps the run's
 * lineage on every one of them.
 *
 * The budget stops a loop from turning one run into a hundred requests. The lineage header is what makes the
 * OTHER loop detectable: an action whose HTTP step reaches its own space's webhook arrives carrying the chain
 * that led there, and the run it would start refuses itself. It names the space's own actions to a backend that
 * space configured, which is the cost of catching a cycle nothing else can see.
 *
 * Every ceiling lives HERE rather than in each task, because this is the only door a task has to the outside
 * world — a task that had to remember to count its own bytes is a task that will forget.
 */
export const createRunFetch = (
  base: typeof fetch,
  signal: AbortSignal,
  limits: ResolvedActionLimits,
  lineage: string[],
  /**
   * Told once, the first time a request is refused for the budget. A task reading many sources usually catches a
   * failed fetch and goes on with the rest, which made the budget invisible: twenty sources answered, the rest
   * "failed" like a network error, and nothing anywhere named the limit.
   */
  onBudgetSpent?: (message: string) => void
): typeof fetch => {
  let issued = 0;

  return async (input, init) => {
    issued += 1;
    if (issued > limits.maxRequests) {
      const message =
        `Action exceeded its ${limits.maxRequests} outbound request budget — request ${issued} and every one after ` +
        'it were refused. A deployment that needs more raises it: `createServer({ action: { limits: { maxRequests } } })`.';
      if (issued === limits.maxRequests + 1) {
        onBudgetSpent?.(message);
      }

      throw new ActionRunError('over_capacity', message);
    }

    const headers = new Headers(init?.headers);
    headers.set('X-Plitzi-Action-Lineage', lineage.join(','));

    return cappedResponse(
      await base(input, { ...init, headers, signal: init?.signal ?? signal }),
      limits.maxResponseBytes,
      message => new ActionRunError('over_capacity', message)
    );
  };
};

/** What a task's context is made of that outlives one run: the server's stores and the run's redactor. */
export type TaskContextDeps = {
  kv: ActionKvStore;
  email: ReturnType<typeof createEmailSender>;
  redactor: ReturnType<typeof createRedactor>;
  /** Absent when the deployment gave no `signingSecret`: its spaces then sign nothing. */
  signing?: ReturnType<typeof createSigning>;
  /** What runs set for later go through: the module's queue, read when asked. */
  later: LaterDeps;
  /** The space's jobs, for a function's `ctx.jobs`. */
  jobs?: FunctionJobsService;
};

/**
 * Who and what the context is for — a run's request, or anything shaped like one (a function's route, a job's slice,
 * whose user is who started it and holds no session).
 */
export type TaskContextRequest = Pick<
  ActionRunRequest,
  'runId' | 'spaceId' | 'environment' | 'trigger' | 'callerId' | 'at' | 'emit' | 'origin'
> & { user?: RunUser };

/**
 * What a task runs with — the one place it is made, for a step of a run and for a function answering a route alike:
 * every secret it resolves registered with the redactor, the space's `kv` namespace, the run's outbound budget, the
 * space's channels. Everything but `log`, which is the STEP's: each step keeps what it logged.
 */
export const taskContextFor = (
  config: ActionsConfig,
  { kv, email, redactor, signing, later, jobs }: TaskContextDeps,
  request: TaskContextRequest,
  signal: AbortSignal,
  runFetch: typeof fetch
): ((scope: Record<string, unknown>) => Omit<ActionTaskContext, 'log'>) => {
  const { realtime } = config;
  const oauthCallbackOrigin = config.functions?.oauth?.callbackOrigin;
  // Made once for the run, not per step: every read of one run sees one version of the data, looked up once.
  const readData = projectDataReader(config.lookups.getData, request.spaceId, request.at);
  const { getVisitor } = config.lookups;

  return scope => ({
    runId: request.runId,
    ...(request.origin ? { origin: request.origin } : {}),
    ...(oauthCallbackOrigin ? { oauthCallbackOrigin } : {}),
    spaceId: request.spaceId,
    environment: request.environment,
    trigger: request.trigger,
    user: request.user,
    callerId: request.callerId,
    signal,
    scope,
    /**
     * The secret a STEP asked for, resolved inside that step and never in the flow scope.
     *
     * There is no allow-list to check it against, deliberately: an action is authored by someone who may edit
     * every action in the space, so a list they can edit is not a boundary — it only ever told the redactor what
     * to look for, and the redactor now learns from what was actually resolved. What IS a boundary is that a
     * credential reaches only the params of the step that named it, which is `renderTaskParams`' whole job.
     */
    credential: async identifier => {
      const credential = await config.lookups.getCredential?.(request.spaceId, identifier);
      if (credential) {
        redactor.add(credential);
      }

      return credential;
    },
    connector: async connectorId => {
      const manifest = await config.lookups.getConnector?.(request.spaceId, connectorId, request.at);
      if (!manifest) {
        return undefined;
      }

      // The connector's own credential: naming the connector is what reaches the secret it declares, exactly as
      // the element-addressed write endpoint has always done.
      const credential = manifest.credential
        ? await config.lookups.getCredential?.(request.spaceId, manifest.credential)
        : undefined;
      if (credential) {
        redactor.add(credential);
      }

      return { manifest, credential };
    },
    fetch: runFetch,
    ...(config.outbound ? { outbound: config.outbound } : {}),
    kv: namespaceKv(kv, request.spaceId),
    dbDrivers: config.dbDrivers ?? [],
    email,
    emit: chunk => request.emit?.(redactor.redact(chunk)),
    data: readData,
    ...(getVisitor ? { visitor: who => getVisitor(request.spaceId, request.environment, who) } : {}),
    ...signing?.({ spaceId: request.spaceId, environment: request.environment }),
    ...(later.queue()
      ? laterFor(later, {
          spaceId: request.spaceId,
          environment: request.environment,
          ...(request.at ? { at: request.at } : {})
        })
      : {}),
    ...(jobs
      ? {
          jobs: declared =>
            jobs.forRun(
              {
                spaceId: request.spaceId,
                environment: request.environment,
                ...(request.at ? { at: request.at } : {}),
                ...(request.user ? { user: request.user } : {})
              },
              declared
            )
        }
      : {}),
    ...(realtime
      ? {
          publish: (topic: string, type: string, data: unknown) =>
            realtime.publish({ spaceId: request.spaceId, environment: request.environment }, topic, type, data),
          grant: (topic: string, ttlSeconds?: number) =>
            realtime.grant({ spaceId: request.spaceId, environment: request.environment }, topic, ttlSeconds),
          revoke: (topic: string, grant?: string) =>
            realtime.revoke({ spaceId: request.spaceId, environment: request.environment }, topic, grant),
          ...(realtime.presence
            ? {
                presence: (topic: string) =>
                  realtime.presence?.({ spaceId: request.spaceId, environment: request.environment }, topic) ??
                  Promise.reject(new Error('This server counts nobody on its channels'))
              }
            : {})
        }
      : {})
  });
};
