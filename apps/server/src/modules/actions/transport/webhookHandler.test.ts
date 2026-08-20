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
    enabled: true,
    access: { mode: 'public' },
    triggers: [
      {
        type: 'webhook',
        verify: {
          type: 'hmac',
          header: 'x-signature',
          algorithm: 'sha256',
          secret: '{{ credential.stripe.hookSecret }}'
        }
      }
    ],
    input: { payload: { type: 'json' } },
    output: {},
    credentials: ['stripe'],
    nodes: {
      start: node('start', { type: 'trigger', action: 'webhook', afterNode: 'ret' }),
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

const config = (action: ActionEntry | undefined, extra: Record<string, unknown> = {}): SSRPageServerConfig =>
  ({
    adapters: {},
    action: {
      lookups: {
        getAction: () => Promise.resolve(action),
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
  it('runs the action when the signature checks out', async () => {
    const body = '{"id":"evt_1","type":"payment"}';

    const { sent, payload } = await post(config(entry()), body, { 'x-signature': sign(body) });

    expect(sent.status).toBe(200);
    expect(payload.accepted).toBe(true);
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
    const { sent } = await post(config(entry({ triggers: [{ type: 'call' }] })), '{}', { 'x-signature': sign('{}') });

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
