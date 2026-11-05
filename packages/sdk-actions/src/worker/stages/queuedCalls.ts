import { readRawBody, requestOrigin } from '@plitzi/sdk-kernel/http';
import { isRecord } from '@plitzi/sdk-shared/helpers';

import { callerIdOf } from './action';
import { actionLookupsOf } from '../../engine/configSeam';
import { keepCall, readKeptCall } from '../../engine/jobs/calls';
import { ActionRunError } from '../../engine/runtime/errors';
import { precheckRun } from '../../engine/runtime/precheck';
import { STATUS_BY_REASON } from '../../engine/transport/callHandler';

import type { ActionsModule } from '../../engine/module';
import type { EngineServerConfig } from '../../types';
import type { BaseContext, Stage } from '@plitzi/sdk-kernel/http';
import type { SSRResponseHelpers } from '@plitzi/sdk-kernel/types';

/** Where a page keeps a call nothing could run, and reads it back: the page server's, on the page's own host. */
export const QUEUED_CALLS_PATH = '/_plitzi/queued';

/** The secret a kept call is read with, beside its job: what the page was answered when it was kept. */
export const TICKET_HEADER = 'x-plitzi-ticket';

const MAX_KEY = 200;

const send = (res: SSRResponseHelpers, status: number, payload: Record<string, unknown>) => {
  res.setStatus(status);
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.send(JSON.stringify(payload));
};

const parse = (body: string): unknown => {
  try {
    return JSON.parse(body) as unknown;
  } catch {
    return undefined;
  }
};

/**
 * Calls kept for later, on the page server: what a page falls back to when no worker answered its call — the page
 * server serves the page's host whatever the workers do. A call is checked here as `/_action` checks it — the action
 * at the revision the page was published at, its access for the session asking, its input — and only then kept, as
 * the caller's, to run on the first worker that can (`keepCall`). `GET …/<job>` with its ticket reads where it is, and
 * once it ran what it answered.
 */
export const createQueuedCallsStage = (config: EngineServerConfig, actions: ActionsModule): Stage<BaseContext> => {
  const lookups = config.action?.lookups ? actionLookupsOf(config.action.lookups) : undefined;

  return async ctx => {
    const { req, res } = ctx;
    if (req.path !== QUEUED_CALLS_PATH && !req.path.startsWith(`${QUEUED_CALLS_PATH}/`)) {
      return false;
    }

    ctx.operation = 'action:queued';
    const { spaceId, environment = 'main', revision = 0 } = req.ctx.spaceDeployment ?? {};
    const jobs = actions.jobs;
    if (typeof spaceId !== 'number' || !jobs || !lookups) {
      send(res, 404, { error: 'This server keeps no calls for later', reason: 'not_found' });

      return true;
    }

    if (req.method === 'GET' && req.path.startsWith(`${QUEUED_CALLS_PATH}/`)) {
      const jobId = decodeURIComponent(req.path.slice(QUEUED_CALLS_PATH.length + 1));
      const raw = req.headers[TICKET_HEADER];
      const ticket = Array.isArray(raw) ? raw[0] : raw;
      const kept = ticket ? await readKeptCall(jobs.queue, spaceId, jobId, ticket) : undefined;
      if (!kept) {
        send(res, 404, { error: 'No call is kept under this id for this ticket', reason: 'not_found' });

        return true;
      }

      send(res, 200, kept);

      return true;
    }

    if (req.method !== 'POST' || req.path !== QUEUED_CALLS_PATH) {
      send(res, 405, { error: 'Keep a call with POST, read it with GET …/<job>', reason: 'invalid_input' });

      return true;
    }

    const body = parse(await readRawBody(ctx.raw));
    const actionId = isRecord(body) ? body.actionId : undefined;
    const input = isRecord(body) ? (body.input ?? {}) : undefined;
    const idempotencyKey = isRecord(body) ? body.idempotencyKey : undefined;
    if (
      typeof actionId !== 'string' ||
      !isRecord(input) ||
      (idempotencyKey !== undefined && (typeof idempotencyKey !== 'string' || idempotencyKey.length > MAX_KEY))
    ) {
      send(res, 400, {
        error: `Expected { actionId, input, idempotencyKey? } (a key of at most ${String(MAX_KEY)} characters)`,
        reason: 'invalid_input'
      });

      return true;
    }

    const at = { environment, revision };
    const entry = await lookups.getAction(spaceId, actionId, at);
    if (!entry) {
      send(res, 404, { error: 'Unknown action', reason: 'not_found' });

      return true;
    }

    try {
      // The same door `/_action` has: a call that would be refused there is refused here, now, not kept to fail.
      precheckRun(entry, { trigger: 'call', input, user: req.ctx.user });
    } catch (error) {
      const reason = error instanceof ActionRunError ? error.reason : 'failed';
      send(res, STATUS_BY_REASON[reason], {
        error: error instanceof Error ? error.message : 'Action refused',
        reason
      });

      return true;
    }

    const origin = requestOrigin(req);
    const kept = await keepCall(jobs.queue, {
      spaceId,
      environment,
      actionId: entry.id,
      input,
      ...(req.ctx.user ? { user: req.ctx.user } : {}),
      callerId: callerIdOf(ctx, req),
      ...(typeof idempotencyKey === 'string' ? { idempotencyKey } : {}),
      origin,
      at
    });
    if ('refused' in kept) {
      send(res, 429, { error: kept.refused, reason: 'over_capacity' });

      return true;
    }

    send(res, 202, { status: 'queued', jobId: kept.jobId, ticket: kept.ticket, runId: '', output: {} });

    return true;
  };
};
