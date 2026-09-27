import { triggerAccess } from '@plitzi/sdk-shared/actions';

import { openStream, wantsStream } from './stream';
import { resolveDebugAuthorization } from '../../../helpers/debugAuthorization';
import { onAbort } from '../../../helpers/onAbort';
import { serverLog } from '../../../helpers/serverLog';
import { ActionRunError } from '../runtime/errors';
import { precheckRun } from '../runtime/precheck';
import { reportReject } from '../runtime/report';
import { triggerParams } from '../runtime/triggers';

import type { RawResponse } from '../../../helpers/buildResponseHelpers';
import type { ActionsModule } from '../index';
import type { ActionRunResult } from '../types';
import type {
  ActionCallRequest,
  ActionEntry,
  ActionErrorReason,
  ActionRejectReason,
  ElementInteraction,
  SSRPageServerConfig,
  SSRRequest,
  SSRResponseHelpers,
  SSRUser
} from '@plitzi/sdk-shared';

export type ActionCallDeps = {
  req: SSRRequest;
  res: SSRResponseHelpers;
  /** The raw response, for the streaming path alone: SSE cannot go through the one-shot helpers. */
  raw: RawResponse;
  config: SSRPageServerConfig;
  module: ActionsModule;
  /** The request's own signal: a caller that hangs up stops the run rather than paying for it to finish. */
  signal: AbortSignal;
  /** Who is asking, for the single-flight key and for cancellation ownership. */
  callerId: string;
  lineage: string[];
};

/**
 * How a refusal reaches the caller.
 *
 * Every reason maps to a status the client can act on without parsing prose — a 409 means "your other run is still
 * going", a 429 means "come back", a 508 means "you built a loop". `recursion` is the one worth the unusual code:
 * 508 Loop Detected says exactly what happened, and anything else would read as a server fault.
 */
const STATUS_BY_REASON: Record<ActionErrorReason, number> = {
  not_found: 404,
  disabled: 409,
  unauthenticated: 401,
  forbidden: 403,
  invalid_input: 422,
  duplicate: 409,
  over_capacity: 429,
  recursion: 508,
  timeout: 504,
  aborted: 499,
  failed: 500
};

const parseBody = (body: string | undefined): ActionCallRequest | undefined => {
  if (!body) {
    return undefined;
  }

  try {
    const parsed: unknown = JSON.parse(body);

    return parsed !== null && typeof parsed === 'object' ? (parsed as ActionCallRequest) : undefined;
  } catch {
    return undefined;
  }
};

const send = (res: SSRResponseHelpers, status: number, payload: Record<string, unknown>, runId?: string) => {
  res.setStatus(status);
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  // A run reflects a mutation the caller just asked for, and its id is how they cancel or correlate it.
  res.setHeader('Cache-Control', 'no-store');
  if (runId) {
    res.setHeader('X-Plitzi-Run-Id', runId);
  }

  res.send(JSON.stringify(payload));
};

const fail = (res: SSRResponseHelpers, reason: ActionErrorReason, error: string, runId?: string) =>
  send(res, STATUS_BY_REASON[reason], { error, reason }, runId);

/**
 * Whether the caller may be told what the flow DID, as opposed to what it answered.
 *
 * The dev-tools Actions tab reads the trace, so this is the rule that decides what it can show — and it is the
 * action's own access rule, not the server's mode. An action open to everybody has already decided that starting
 * it is anybody's business, so its steps are too; one that asks for a session owes its steps to a session and to
 * nobody else. `devMode` on its own is not an answer to that question: it says this deployment is being built,
 * not that whoever just posted to the endpoint is the person building it.
 *
 * It is deliberately a second lock on a door `precheckRun` already shut — an anonymous call to a `session` action
 * never becomes a run. That is the point: the trace is the one part of the answer that carries the author's own
 * data, and the day a deployment mounts a trigger of its own is the day it stops being covered by the first lock.
 */
const mayReadTrace = (trigger: ElementInteraction, user?: SSRUser): boolean =>
  triggerAccess(triggerParams(trigger))?.mode === 'public' || user !== undefined;

/**
 * Handles an action-addressed call.
 *
 * The browser names an action and hands it inputs. Everything that decides whether the run may happen — the
 * document, the access rule, the input contract, the lineage — is the runner's, so a deployment mounting its own
 * trigger cannot end up with a weaker set of checks than this endpoint applies.
 */
export const handleActionCall = async (deps: ActionCallDeps): Promise<void> => {
  const { req, res, raw, config, module, signal, callerId, lineage } = deps;
  const { environment = 'main', spaceId, revision = 0, authoring } = req.ctx.spaceDeployment ?? {};
  if (typeof spaceId !== 'number') {
    fail(res, 'not_found', 'Invalid space deployment');

    return;
  }

  const body = parseBody(req.body);
  if (!body?.actionId) {
    fail(res, 'invalid_input', 'Expected { actionId, input }');

    return;
  }

  /**
   * A call that never became a run, told to whoever keeps the deployment's records.
   *
   * The caller already learns the reason from the status and the payload — that is what makes a refusal
   * actionable for them. This is the other half: an author watching their own space see that calls are arriving
   * and being turned away, which is otherwise a thing only the browser's network tab knows.
   */
  const reject = (reason: ActionRejectReason, detail?: string) =>
    reportReject(config, {
      actionId: body.actionId,
      spaceId,
      environment,
      trigger: 'call',
      reason,
      callerId,
      ...(detail === undefined ? {} : { detail })
    });

  // As of the revision this page was published at. A page and the flows it calls ship together, or a page shipped
  // yesterday runs whatever the action says today.
  const entry = (await config.action?.lookups?.getAction(spaceId, body.actionId, { environment, revision })) as
    ActionEntry | undefined;
  if (!entry) {
    await reject('not_found', 'No action with this identifier at the revision being served');
    fail(res, 'not_found', 'Unknown action');

    return;
  }

  const limits = module.limitsFor(entry.document);
  const input = body.input ?? {};
  const begin = {
    spaceId,
    actionId: entry.id,
    callerId,
    input,
    ...(body.idempotencyKey ? { idempotencyKey: body.idempotencyKey } : {}),
    ttlMs: limits.timeoutMs
  };

  /**
   * The answer this key already produced, for a caller repeating itself after the first run finished.
   *
   * Only ever a key the caller NAMED: they told us which request this is, so answering the retry with what it
   * answered the first time is what they asked for. Not metered and not counted — nothing ran.
   */
  const replayed = await module.guards.replay(begin);
  if (replayed) {
    res.setHeader('X-Plitzi-Replayed', 'true');
    send(res, 200, { ...replayed, replayed: true }, replayed.runId);

    return;
  }

  let run;
  let entryPoint;
  try {
    // Before anything is spent: a refusal here has taken no slot and no metering event.
    entryPoint = precheckRun(entry, { trigger: 'call', input, user: req.ctx.user, lineage }).trigger;
    run = await module.guards.begin(begin);
  } catch (error) {
    const reason = error instanceof ActionRunError ? error.reason : 'failed';
    await reject(reason, error instanceof Error ? error.message : undefined);
    fail(res, reason, error instanceof Error ? error.message : 'Action refused');

    return;
  }

  // Metered before it runs and regardless of the outcome, because the work is spent either way. A run refused
  // above never reaches here: billing a 409 would only teach callers to retry harder.
  await config.adapters.meter?.({ kind: 'server_action', cached: false, req, spaceId, environment, revision });

  const abortRun = () => run.controller.abort();
  const releaseAbort = onAbort(signal, abortRun);

  // Negotiated by the caller, and only for a run that is already allowed to start: everything above answers with a
  // status code, which a stream has already spent by the time it could say anything.
  const stream = wantsStream(req.headers.accept) ? openStream(raw, abortRun, run.runId) : undefined;

  /**
   * What a debugger may be told about this run, beside its answer.
   *
   * The OUTLINE — which steps ran, how each ended, where the flow broke — goes to a page whose debugging the
   * deployment authorized: a dev server, or a space that switched dev tools on for its own site. Nothing else gets
   * it, and it carries nothing a step was given or returned.
   *
   * The full TRACE, with every step's results, only to an authoring request or a development server: those results
   * can hold another visitor's data, and sending them to an authoring request is what puts a SERVER run in the same
   * Workflow debugger as a client one. Both are gated on the ACTION too — one behind a session tells an anonymous
   * caller nothing about its flow.
   *
   * Answered once the run is over, for the answer and for the failure alike: a run that died on its deadline is
   * exactly the one somebody is debugging.
   */
  const readsRun = mayReadTrace(entryPoint, req.ctx.user);
  const fullTrace = readsRun && (authoring === true || config.devMode === true);
  const showsOutline = async (): Promise<boolean> =>
    readsRun &&
    (fullTrace ||
      (await resolveDebugAuthorization(
        config,
        async () => (await config.adapters.getOfflineData(spaceId, environment, revision))?.schema.settings
      )));

  let outcome;
  try {
    const result: ActionRunResult = await module.runAction({
      entry,
      input,
      spaceId,
      environment,
      trigger: 'call',
      user: req.ctx.user,
      callerId,
      runId: run.runId,
      lineage,
      at: { environment, revision },
      signal: run.controller.signal,
      ...(stream
        ? {
            emit: chunk => stream.send({ event: 'data', data: { chunk } }),
            onNode: (id, status) => stream.send({ event: 'node', data: { id, status } })
          }
        : {})
    });

    outcome = result;
    const outline = await showsOutline();

    if (stream) {
      stream.send({
        event: 'done',
        data: {
          runId: result.runId,
          status: result.status,
          output: result.output,
          ...(result.error === undefined ? {} : { error: result.error }),
          ...(outline ? { steps: result.steps } : {})
        }
      });
      stream.close();

      return;
    }

    const payload: Record<string, unknown> = {
      runId: result.runId,
      status: result.status,
      output: result.output,
      // The reason a step wrote for the caller (`ActionRefusal`); no other failure's message leaves the server.
      ...(result.error === undefined ? {} : { error: result.error })
    };
    if (outline) {
      payload.steps = result.steps;
    }

    if (fullTrace) {
      payload.trace = result.trace;
    }

    send(res, 200, payload, result.runId);
  } catch (error) {
    const reason = error instanceof ActionRunError ? error.reason : 'failed';
    const message = error instanceof ActionRunError ? error.message : 'Action failed';
    if (!(error instanceof ActionRunError)) {
      // A provider's own message can carry its URL or internal details, so the caller gets a flat failure and the
      // detail stays in the server's log.
      serverLog.error('Actions', 'run failed', error);
    }

    // A run that STARTED and then hit a ceiling took steps on the way there, and they are the only account of what it
    // managed to do before it died. Carried by the error itself; a refusal that never became a run has none.
    const steps = error instanceof ActionRunError && error.steps && (await showsOutline()) ? error.steps : undefined;

    if (stream) {
      // The status line is long gone by the time a stream fails, so the failure travels as a frame. Same reason
      // vocabulary either way, so a client reads one shape.
      stream.send({
        event: 'error',
        data: { runId: run.runId, error: message, reason, ...(steps ? { steps } : {}) }
      });
      stream.close();

      return;
    }

    send(res, STATUS_BY_REASON[reason], { error: message, reason, ...(steps ? { steps } : {}) }, run.runId);
  } finally {
    releaseAbort();
    // With the answer, so a caller that named its own key and asks again gets what it already got rather than a
    // second run of the same intent.
    await module.guards.end(run, outcome);
  }
};
