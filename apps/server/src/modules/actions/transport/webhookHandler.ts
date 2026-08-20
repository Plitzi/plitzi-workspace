import { triggerVerify } from '@plitzi/sdk-shared/actions';

import { verifySignature } from './verifySignature';
import { ActionRunError } from '../runtime/errors';
import { precheckRun } from '../runtime/precheck';
import { findTriggerNode, triggerParams } from '../runtime/triggers';

import type { ActionsModule } from '../index';
import type { ActionCredential } from '../types';
import type {
  ActionEntry,
  ActionWebhookVerification,
  SSRPageServerConfig,
  SSRRequest,
  SSRResponseHelpers
} from '@plitzi/sdk-shared';

export type ActionWebhookDeps = {
  req: SSRRequest;
  res: SSRResponseHelpers;
  config: SSRPageServerConfig;
  module: ActionsModule;
  signal: AbortSignal;
  actionId: string;
  /** The caller's address: a webhook has no session, so this is all there is to rate limit by. */
  callerId: string;
  lineage: string[];
};

const DEFAULT_PER_MINUTE = 60;

const send = (res: SSRResponseHelpers, status: number, payload: Record<string, unknown>) => {
  res.setStatus(status);
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.send(JSON.stringify(payload));
};

/**
 * The signing secret, from the credential the verification NAMES.
 *
 * Named outright rather than templated. This runs before anything else does — before the body is parsed, before a
 * run exists — so there is no flow scope for a token to resolve against, and one that rendered to nothing would
 * leave the endpoint verifying every request against an empty secret.
 */
const resolveSecret = async (
  verification: ActionWebhookVerification,
  spaceId: number,
  getCredential?: (spaceId: number, identifier: string) => Promise<ActionCredential | undefined>
): Promise<string> => {
  const credential = await getCredential?.(spaceId, verification.credential);
  const secret = credential?.[verification.secretField ?? 'secret'];

  return typeof secret === 'string' ? secret : '';
};

/**
 * Handles an inbound webhook.
 *
 * The public face of an action, and the one an attacker can reach without a session — so everything that costs
 * anything happens after the signature is checked, in this order: the action must exist and declare the trigger,
 * the rate limit must allow it, the signature must verify, and only then does a run start.
 *
 * The answer is deliberately thin. A sender needs to know it was accepted; it has no business learning whether an
 * action exists, why a run failed, or what the flow did — and a 404 that distinguishes "no such action" from
 * "wrong signature" is an oracle for both.
 */
export const handleActionWebhook = async (deps: ActionWebhookDeps): Promise<void> => {
  const { req, res, config, module, signal, actionId, callerId, lineage } = deps;
  const { environment = 'main', spaceId, revision = 0 } = req.ctx.spaceDeployment ?? {};
  if (typeof spaceId !== 'number') {
    send(res, 404, { error: 'Not found' });

    return;
  }

  // The LIVE document, deliberately. A webhook URL belongs to the space, not to a published page: nothing about
  // the sender says which revision it means, and pinning one would leave a fixed flow answering an integration
  // its author has since corrected.
  const entry = (await config.action?.lookups?.getAction(spaceId, actionId)) as ActionEntry | undefined;
  // The step that declares this way in. No step, no webhook — an action reachable only from a page has no URL.
  const trigger = entry ? findTriggerNode(entry.document.nodes, 'webhook') : undefined;
  if (!entry || !trigger) {
    send(res, 404, { error: 'Not found' });

    return;
  }

  const verify = triggerVerify(triggerParams(trigger));

  // Counted before the signature is checked: verifying costs a hash over an attacker-supplied body, and a flood of
  // unsigned requests must not be free just because none of them verifies.
  const perMinute = config.action?.rateLimit?.webhookPerMinute ?? DEFAULT_PER_MINUTE;
  const window = Math.floor(Date.now() / 60_000);
  try {
    const hits = await module.kv(spaceId).increment(`hook:${actionId}:${callerId}:${window}`, 1, 120);
    if (hits > perMinute) {
      res.setHeader('Retry-After', '60');
      send(res, 429, { error: 'Too many requests' });

      return;
    }
  } catch {
    // A store that cannot count cannot limit. Refusing is the safe half of a fail-closed rule: a public endpoint
    // with no rate limit is exactly what this protects.
    send(res, 503, { error: 'Unavailable' });

    return;
  }

  const rawBody = req.body ?? '';
  if (verify) {
    const secret = await resolveSecret(verify, spaceId, config.action?.lookups?.getCredential);
    const check = verifySignature(verify, secret, req.headers, rawBody);
    if (!check.ok) {
      // The reason goes to the log, not the wire: telling a caller which half of the check failed helps only the
      // caller who should not be here.
      console.warn(`[Actions] webhook "${actionId}" rejected: ${check.reason}`);
      send(res, 401, { error: 'Invalid signature' });

      return;
    }
  }

  let payload: Record<string, unknown> = {};
  try {
    const parsed: unknown = rawBody ? JSON.parse(rawBody) : {};
    payload = parsed !== null && typeof parsed === 'object' ? (parsed as Record<string, unknown>) : {};
  } catch {
    send(res, 400, { error: 'Body is not JSON' });

    return;
  }

  // The body's own keys, plus the whole body under `payload`: a document naming the two fields it cares about gets
  // those, and one that needs the envelope declares `payload: json` and gets everything. Undeclared keys are
  // dropped by the input contract either way.
  const input = { ...payload, payload };
  const limits = module.limitsFor(entry.document);
  let run;
  try {
    precheckRun(entry, { trigger: 'webhook', input, lineage });
    run = module.guards.begin({
      spaceId,
      actionId: entry.id,
      callerId,
      input,
      // A provider retrying the same delivery must not run the flow twice; a provider that sends no delivery id
      // falls back to the derived key over the body, which is the same thing for an identical retry.
      idempotencyKey: deliveryId(req),
      ttlMs: limits.timeoutMs
    });
  } catch (error) {
    const reason = error instanceof ActionRunError ? error.reason : 'failed';
    // A duplicate delivery is a SUCCESS from the sender's side: it asked for the work once and the work is
    // happening. Answering an error would make a well-behaved provider retry harder.
    send(res, reason === 'duplicate' ? 202 : 400, { accepted: reason === 'duplicate' });

    return;
  }

  await config.adapters.meter?.({ kind: 'server_action', cached: false, req, spaceId, environment, revision });

  const abortRun = () => run.controller.abort();
  signal.addEventListener('abort', abortRun);

  try {
    const result = await module.runAction({
      entry,
      input,
      spaceId,
      environment,
      trigger: 'webhook',
      runId: run.runId,
      lineage,
      signal: run.controller.signal
    });

    send(res, 200, { accepted: true, runId: result.runId, status: result.status });
  } catch (error) {
    console.error('[Actions] webhook run failed:', error);
    // 500 rather than a flat 200: most providers retry a 5xx, and a run that failed for a transient reason is
    // exactly the one worth retrying.
    send(res, 500, { accepted: false });
  } finally {
    signal.removeEventListener('abort', abortRun);
    module.guards.end(run);
  }
};

/** The delivery id a provider sends, under the header names the common ones use. */
const deliveryId = (req: SSRRequest): string | undefined => {
  for (const name of ['x-plitzi-delivery', 'x-github-delivery', 'x-request-id', 'idempotency-key']) {
    const value = req.headers[name];
    const single = Array.isArray(value) ? value[0] : value;
    if (single) {
      return single;
    }
  }

  return undefined;
};
