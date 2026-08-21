import { openStream, wantsStream } from './stream';
import { onAbort } from '../../../helpers/onAbort';
import { ActionRunError } from '../runtime/errors';
import { precheckRun } from '../runtime/precheck';

import type { RawResponse } from '../../../helpers/buildResponseHelpers';
import type { ActionsModule } from '../index';
import type { ActionRunResult } from '../types';
import type {
  ActionCallRequest,
  ActionEntry,
  ActionErrorReason,
  SSRPageServerConfig,
  SSRRequest,
  SSRResponseHelpers
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

  // As of the revision this page was published at. A page and the flows it calls ship together, or a page shipped
  // yesterday runs whatever the action says today.
  const entry = (await config.action?.lookups?.getAction(spaceId, body.actionId, { environment, revision })) as
    ActionEntry | undefined;
  if (!entry) {
    fail(res, 'not_found', 'Unknown action');

    return;
  }

  const limits = module.limitsFor(entry.document);
  const input = body.input ?? {};
  let run;
  try {
    // Before anything is spent: a refusal here has taken no slot and no metering event.
    precheckRun(entry, { trigger: 'call', input, user: req.ctx.user, lineage });
    run = await module.guards.begin({
      spaceId,
      actionId: entry.id,
      callerId,
      input,
      idempotencyKey: body.idempotencyKey,
      ttlMs: limits.timeoutMs
    });
  } catch (error) {
    const reason = error instanceof ActionRunError ? error.reason : 'failed';
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
  const stream = wantsStream(req.headers.accept) ? openStream(raw, abortRun) : undefined;

  try {
    const result: ActionRunResult = await module.runAction({
      entry,
      input,
      spaceId,
      environment,
      trigger: 'call',
      user: req.ctx.user,
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

    if (stream) {
      stream.send({ event: 'done', data: { runId: result.runId, status: result.status, output: result.output } });
      stream.close();

      return;
    }

    // The trace names steps, and its results are the author's own data; a visitor gets the answer alone. Sending
    // it to an authoring request is what puts a SERVER run in the same Workflow debugger as a client one.
    const payload: Record<string, unknown> = { runId: result.runId, status: result.status, output: result.output };
    if (authoring === true || config.devMode === true) {
      payload.trace = result.trace;
    }

    send(res, 200, payload, result.runId);
  } catch (error) {
    const reason = error instanceof ActionRunError ? error.reason : 'failed';
    const message = error instanceof ActionRunError ? error.message : 'Action failed';
    if (!(error instanceof ActionRunError)) {
      // A provider's own message can carry its URL or internal details, so the caller gets a flat failure and the
      // detail stays in the server's log.
      console.error('[Actions] run failed:', error);
    }

    if (stream) {
      // The status line is long gone by the time a stream fails, so the failure travels as a frame. Same reason
      // vocabulary either way, so a client reads one shape.
      stream.send({ event: 'error', data: { runId: run.runId, error: message, reason } });
      stream.close();

      return;
    }

    fail(res, reason, message, run.runId);
  } finally {
    releaseAbort();
    await module.guards.end(run);
  }
};
