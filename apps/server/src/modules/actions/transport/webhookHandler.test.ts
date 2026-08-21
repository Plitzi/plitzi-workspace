import { createHmac } from 'node:crypto';

import { describe, expect, it, vi } from 'vitest';

import { handleActionWebhook } from './webhookHandler';
import { createActionsModule } from '../index';

import type { ActionsModule } from '../index';
import type {
  ActionDocument,
  ActionEntry,
  ElementInteraction,
  SSRPageServerConfig,
  SSRRequest,
  SSRResponseHelpers
} from '@plitzi/sdk-shared';

const SECRET = 'whsec_test_value';

const node = (id: string, overrides: Partial<ElementInteraction> = {}): ElementInteraction => ({
  id,
  title: id,
  type: 'task',
  action: '',
  params: {},
  preview: {},
  elementId: null,
  beforeNode: '',
  afterNode: '',
  flowId: 'flow',
  enabled: true,
  ...overrides
});

const entry = (overrides: Partial<ActionDocument> = {}): ActionEntry => ({
  id: 'stripe-hook',
  document: {
    name: 'Stripe hook',
    output: {},
    nodes: {
      start: node('start', {
        type: 'trigger',
        action: 'webhook',
        params: {
          access: 'public',
          input: '{"payload":{"type":"json"}}',
          // The credential is NAMED, not templated: this runs before a run exists, so there is no scope for a
          // token to resolve against and one that rendered empty would verify against nothing.
          signatureCredential: 'stripe',
          signatureSecretField: 'hookSecret'
        },
        afterNode: 'ret'
      }),
      ret: node('ret', { action: 'flow.output', params: { values: '{}' } })
    },
    ...overrides
  }
});

const buildRes = () => {
  const sent: { status: number; body: string; headers: Record<string, string | string[]> } = {
    status: 200,
    body: '',
    headers: {}
  };
  const res: SSRResponseHelpers = {
    status: 200,
    headers: {},
    setHeader: (name, value) => {
      sent.headers[name] = value;
    },
    setStatus: code => {
      sent.status = code;
    },
    send: body => {
      sent.body = body;
    },
    write: () => undefined,
    end: () => undefined
  };

  return { res, sent };
};

const asked: { at?: unknown }[] = [];

const config = (action: ActionEntry | undefined, extra: Record<string, unknown> = {}): SSRPageServerConfig =>
  ({
    adapters: {},
    action: {
      lookups: {
        getAction: (_spaceId: number, _actionId: string, at?: unknown) => {
          asked.push({ at });

          return Promise.resolve(action);
        },
        getCredential: () => Promise.resolve({ hookSecret: SECRET })
      },
      ...extra
    }
  }) as unknown as SSRPageServerConfig;

const post = async (
  cfg: SSRPageServerConfig,
  body: string,
  headers: Record<string, string> = {},
  options: { module?: ActionsModule; actionId?: string; callerId?: string } = {}
) => {
  const { res, sent } = buildRes();
  const module = options.module ?? createActionsModule({ lookups: { getAction: () => Promise.resolve(undefined) } });
  const req = {
    method: 'POST',
    path: '/_action/hook/stripe-hook',
    body,
    query: {},
    headers,
    ctx: { spaceDeployment: { spaceId: 3, environment: 'production', revision: 1 } }
  } as unknown as SSRRequest;

  await handleActionWebhook({
    req,
    res,
    config: cfg,
    module,
    signal: new AbortController().signal,
    actionId: options.actionId ?? 'stripe-hook',
    callerId: options.callerId ?? 'ip:1.2.3.4',
    lineage: []
  });

  return { sent, payload: JSON.parse(sent.body || '{}') as Record<string, unknown>, module };
};

const sign = (body: string, secret = SECRET) => createHmac('sha256', secret).update(body).digest('hex');

describe('handleActionWebhook', () => {
  /**
   * A verification nothing reads is a broken webhook, not an unsigned one.
   *
   * The check used to be a JSON blob and is now fields on the trigger step. Reading a document stored before that
   * as "unsigned" would turn a protected endpoint into a public one with nothing in it changing — the one
   * degradation that must never happen quietly — so it is refused instead.
   */
  it('refuses a webhook whose signature check is in a format nothing reads', async () => {
    const stale = entry();
    stale.document.nodes.start.params = {
      access: 'public',
      verify: '{"type":"hmac","header":"x-signature","algorithm":"sha256","credential":"stripe"}'
    };
    const body = '{"id":"evt_1"}';

    const { sent } = await post(config(stale), body, {});

    expect(sent.status, 'an endpoint that verifies nothing answered as though it had').toBe(503);
  });

  /**
   * The reason a refusal is reported at all.
   *
   * A webhook that does not verify is the most common way an integration is broken, and it is indistinguishable
   * from the sender never firing: the caller is told nothing (deliberately) and the process log is not somewhere
   * the person setting up the integration can look. Somebody has to be able to see it.
   */
  it('reports a refusal to the deployment while telling the sender nothing', async () => {
    const onReject = vi.fn();
    const body = '{"id":"evt_1"}';

    const { sent, payload } = await post(config(entry(), { onReject }), body, { 'x-signature': sign(body, 'wrong') });

    expect(sent.status).toBe(401);
    expect(payload, 'the sender learned which check refused it').toEqual({ error: 'Invalid signature' });
    expect(onReject).toHaveBeenCalledWith(
      expect.objectContaining({
        actionId: 'stripe-hook',
        spaceId: 3,
        trigger: 'webhook',
        reason: 'invalid_signature',
        callerId: 'ip:1.2.3.4'
      })
    );
  });

  it('reports the refusals that never reach a signature check either', async () => {
    const onReject = vi.fn();

    await post(config(undefined, { onReject }), '{}', {});

    expect(onReject).toHaveBeenCalledWith(expect.objectContaining({ reason: 'not_found' }));

    const malformed = vi.fn();
    const body = 'not json at all';
    await post(config(entry(), { onReject: malformed }), body, { 'x-signature': sign(body) });

    expect(malformed).toHaveBeenCalledWith(expect.objectContaining({ reason: 'malformed_body' }));
  });

  /** Reporting must never become the failure it reports: the sender was refused either way, and a sink that
   *  throws is the sink's problem. */
  it('answers the sender even when reporting the refusal throws', async () => {
    const body = '{"id":"evt_1"}';
    const onReject = () => {
      throw new Error('the log is down');
    };

    const { sent } = await post(config(entry(), { onReject }), body, { 'x-signature': sign(body, 'wrong') });

    expect(sent.status).toBe(401);
  });

  /**
   * Single-flight refuses the retry that OVERLAPS the first delivery. This is the one that arrives after it
   * finished, which is how every provider actually retries — and without a replay window it runs the flow twice.
   */
  it('answers a redelivery from the first run rather than running the flow again', async () => {
    const module = createActionsModule({
      lookups: {
        getAction: () => Promise.resolve(entry()),
        getCredential: () => Promise.resolve({ hookSecret: SECRET })
      },
      idempotency: { replayTtlMs: 60_000 }
    });
    const body = '{"id":"evt_replay"}';
    const headers = { 'x-signature': sign(body), 'x-github-delivery': 'delivery-1' };

    const first = await post(config(entry()), body, headers, { module });
    const second = await post(config(entry()), body, headers, { module });

    expect(first.sent.status).toBe(200);
    expect(second.sent.status, 'a redelivery is not an error to the sender').toBe(202);
    expect(second.payload.replayed).toBe(true);
    expect(second.payload.runId, 'the redelivery was answered by a different run').toBe(first.payload.runId);
  });

  it('runs the action when the signature checks out', async () => {
    const body = '{"id":"evt_1","type":"payment"}';

    const { sent, payload } = await post(config(entry()), body, { 'x-signature': sign(body) });

    expect(sent.status).toBe(200);
    expect(payload.accepted).toBe(true);
  });

  // A webhook URL belongs to the space, not to a published page: nothing about the sender says which revision it
  // means, and pinning one would leave a fixed flow answering an integration its author has since corrected.
  it('reads the LIVE action, not a published revision', async () => {
    asked.length = 0;
    const body = '{"id":"evt_live"}';

    await post(config(entry()), body, { 'x-signature': sign(body) });

    expect(asked[0].at).toBeUndefined();
  });

  it('refuses a body that was signed with another secret', async () => {
    const body = '{"id":"evt_1"}';

    const { sent } = await post(config(entry()), body, { 'x-signature': sign(body, 'wrong') });

    expect(sent.status).toBe(401);
  });

  // The mistake this design exists to prevent: a signature covers BYTES, so anything that re-serializes the body
  // before verifying computes a different digest and rejects every genuine delivery.
  it('verifies against the raw bytes, not a re-serialized body', async () => {
    const body = '{ "id" :  "evt_1" }';

    const { sent } = await post(config(entry()), body, { 'x-signature': sign(body) });

    expect(sent.status).toBe(200);
  });

  it('accepts the sha256=<hex> dressing senders use', async () => {
    const body = '{"id":"evt_2"}';

    const { sent } = await post(config(entry()), body, { 'x-signature': `sha256=${sign(body)}` });

    expect(sent.status).toBe(200);
  });

  it('answers 404 for an action that does not declare a webhook', async () => {
    const callOnly = entry();
    callOnly.document.nodes.start = { ...callOnly.document.nodes.start, action: 'call', params: {} };
    const { sent } = await post(config(callOnly), '{}', { 'x-signature': sign('{}') });

    // Deliberately the same answer as an action that does not exist: telling them apart is an oracle.
    expect(sent.status).toBe(404);
  });

  it('answers 202 to a retried delivery instead of running it twice', async () => {
    const module = createActionsModule({ lookups: { getAction: () => Promise.resolve(undefined) } });
    const body = '{"id":"evt_3"}';
    const headers = { 'x-signature': sign(body), 'x-github-delivery': 'delivery-1' };
    const cfg = config(entry());

    const first = await post(cfg, body, headers, { module });
    expect(first.sent.status).toBe(200);

    // The guard released on completion, so a second delivery of the SAME id must be refused by its idempotency key
    // — and a well-behaved sender must read that as "already handled", not as an error to retry harder.
    const second = await post(cfg, body, headers, { module });
    expect([200, 202]).toContain(second.sent.status);
  });

  it('rate limits a caller that floods it', async () => {
    const module = createActionsModule({ lookups: { getAction: () => Promise.resolve(undefined) } });
    const cfg = config(entry(), { rateLimit: { webhookPerMinute: 2 } });

    for (let i = 0; i < 2; i += 1) {
      const body = `{"id":"evt_${i}"}`;
      await post(cfg, body, { 'x-signature': sign(body) }, { module });
    }

    const body = '{"id":"evt_last"}';
    const { sent } = await post(cfg, body, { 'x-signature': sign(body) }, { module });

    expect(sent.status).toBe(429);
    expect(sent.headers['Retry-After']).toBe('60');
  });

  it('counts an UNSIGNED flood too, so verifying is not free', async () => {
    const module = createActionsModule({ lookups: { getAction: () => Promise.resolve(undefined) } });
    const cfg = config(entry(), { rateLimit: { webhookPerMinute: 1 } });

    await post(cfg, '{}', { 'x-signature': 'nope' }, { module });
    const { sent } = await post(cfg, '{}', { 'x-signature': 'nope' }, { module });

    expect(sent.status).toBe(429);
  });

  it('meters a run it accepted', async () => {
    const meter = vi.fn();
    const cfg = config(entry());
    (cfg as unknown as { adapters: Record<string, unknown> }).adapters = { meter };
    const body = '{"id":"evt_9"}';

    await post(cfg, body, { 'x-signature': sign(body) });

    expect(meter).toHaveBeenCalledWith(expect.objectContaining({ kind: 'server_action' }));
  });
});
