import { describe, expect, it } from 'vitest';

import { validateActionDocument } from './validateDocument';

/** A trigger STEP, which is where what-starts-it, who-may and with-what all live now. */
const trigger = (action: string, params: Record<string, unknown> = {}, afterNode = 'ret') => ({
  id: 'start',
  type: 'trigger',
  action,
  params,
  afterNode
});

/** Flat and stringy, as the flow editor writes them: a select for access, JSON for the input contract. */
const callTrigger = (params: Record<string, unknown> = {}) =>
  trigger('call', { access: 'session', input: '{"amount":{"type":"number","required":true}}', ...params });

const document = (overrides: Record<string, unknown> = {}) => ({
  name: 'Send quote',
  enabled: true,
  output: { total: { type: 'number' } },
  nodes: {
    start: callTrigger(),
    ret: { id: 'ret', type: 'task', action: 'flow.output', params: { values: '{}' } }
  },
  ...overrides
});

const messages = (issues: { message: string }[]) => issues.map(issue => issue.message).join(' | ');

describe('validateActionDocument', () => {
  it('accepts a document the runner can execute', () => {
    const report = validateActionDocument(document());

    expect(report.valid).toBe(true);
    expect(report.errors).toEqual([]);
    expect(report.warnings).toEqual([]);
  });

  it('refuses anything that is not a document', () => {
    expect(validateActionDocument(undefined).valid).toBe(false);
    expect(validateActionDocument('nope').valid).toBe(false);
    expect(validateActionDocument([]).valid).toBe(false);
  });

  it('requires a way in', () => {
    const report = validateActionDocument(
      document({ nodes: { ret: { id: 'ret', type: 'task', action: 'flow.output', params: {} } } })
    );

    expect(report.valid).toBe(false);
    expect(messages(report.errors)).toContain('no way in');
  });

  it('requires access on the trigger rather than guessing it', () => {
    const report = validateActionDocument(
      document({ nodes: { start: trigger('call', {}), ret: { id: 'ret', type: 'task', action: 'flow.output' } } })
    );

    expect(report.valid).toBe(false);
    expect(messages(report.errors)).toContain('must say who may start a run');
  });

  it('requires role access to name permissions', () => {
    const report = validateActionDocument(
      document({
        nodes: {
          start: callTrigger({ access: 'role', permissions: '' }),
          ret: { id: 'ret', type: 'task', action: 'flow.output' }
        }
      })
    );

    expect(messages(report.errors)).toContain('at least one permission');
  });

  /** A clock is not a caller. Asking a schedule for an access rule only invites one that means nothing. */
  it('asks a schedule for a cron and not for access', () => {
    const report = validateActionDocument(
      document({
        nodes: {
          start: trigger('schedule', { cron: '0 6 * * *' }),
          ret: { id: 'ret', type: 'task', action: 'flow.output' }
        }
      })
    );

    expect(report.valid).toBe(true);
  });

  it('refuses a cron this server could never fire', () => {
    const report = validateActionDocument(
      document({
        nodes: {
          start: trigger('schedule', { cron: 'every morning' }),
          ret: { id: 'ret', type: 'task', action: 'flow.output' }
        }
      })
    );

    expect(report.valid).toBe(false);
    expect(messages(report.errors)).toContain('would never fire');
  });

  /** Two ways into one action, each on its own terms — the thing a single document-level access rule could not
   *  express: the webhook is gated on its signature while the page call still needs a session. */
  it('accepts several triggers, each with its own access', () => {
    const report = validateActionDocument(
      document({
        nodes: {
          onCall: { ...callTrigger(), id: 'onCall', afterNode: 'ret', flowId: 'a' },
          ret: { id: 'ret', type: 'task', action: 'flow.output', params: {}, flowId: 'a' },
          onHook: {
            ...trigger('webhook', {
              access: 'public',
              verify: '{"type":"hmac","header":"x-sig","algorithm":"sha256","credential":"stripe"}'
            }),
            id: 'onHook',
            afterNode: 'count',
            flowId: 'b'
          },
          count: { id: 'count', type: 'task', action: 'kv.increment', params: {}, flowId: 'b' }
        }
      })
    );

    expect(report.valid).toBe(true);
    expect(report.warnings).toEqual([]);
  });

  it('refuses two triggers of the same kind, which would make the entry point a matter of key order', () => {
    const report = validateActionDocument(
      document({
        nodes: {
          onCall: { ...callTrigger(), id: 'onCall', afterNode: 'ret' },
          alsoCall: { ...callTrigger(), id: 'alsoCall', afterNode: 'ret' },
          ret: { id: 'ret', type: 'task', action: 'flow.output', params: {} }
        }
      })
    );

    expect(report.valid).toBe(false);
    expect(messages(report.errors)).toContain('2 "call" triggers');
  });

  // The rule the whole validator exists for: a client step in a server flow is shaped correctly and can never run.
  it('refuses a browser step inside a server flow', () => {
    const report = validateActionDocument(
      document({
        nodes: {
          start: callTrigger(),
          set: { id: 'set', type: 'globalCallback', action: 'setState' }
        }
      })
    );

    expect(report.valid).toBe(false);
    expect(messages(report.errors)).toContain('cannot run on the server');
  });

  it('refuses a step that does not name a task', () => {
    const report = validateActionDocument(
      document({
        nodes: { start: callTrigger(), ret: { id: 'ret', type: 'task', action: 'notATask' } }
      })
    );

    expect(report.valid).toBe(false);
    expect(messages(report.errors)).toContain('<namespace>.<action>');
  });

  it('refuses a step chained to one that is not there', () => {
    const report = validateActionDocument(
      document({
        nodes: {
          start: callTrigger(),
          ret: { id: 'ret', type: 'task', action: 'flow.output', afterNode: 'ghost' }
        }
      })
    );

    expect(report.valid).toBe(false);
    expect(messages(report.errors)).toContain('not a step here');
  });

  it('warns about a step no trigger reaches', () => {
    const report = validateActionDocument(
      document({
        nodes: {
          start: callTrigger(),
          ret: { id: 'ret', type: 'task', action: 'flow.output', params: {} },
          orphan: { id: 'orphan', type: 'task', action: 'kv.set', params: {} }
        }
      })
    );

    expect(report.valid).toBe(true);
    expect(messages(report.warnings)).toContain('never runs');
  });

  it('warns about a webhook anyone can call unsigned', () => {
    const report = validateActionDocument(
      document({
        nodes: {
          start: trigger('webhook', { access: 'public' }),
          ret: { id: 'ret', type: 'task', action: 'flow.output', params: {} }
        }
      })
    );

    expect(report.valid).toBe(true);
    expect(messages(report.warnings)).toContain('unsigned requests');
  });

  it('refuses a verification that names no credential to read the secret from', () => {
    const report = validateActionDocument(
      document({
        nodes: {
          start: trigger('webhook', {
            access: 'public',
            verify: '{"type":"hmac","header":"x-sig","algorithm":"sha256"}'
          }),
          ret: { id: 'ret', type: 'task', action: 'flow.output', params: {} }
        }
      })
    );

    expect(report.valid).toBe(false);
    expect(messages(report.errors)).toContain('names no credential');
  });

  it('warns that a public call is reachable by signed-out visitors', () => {
    const report = validateActionDocument(
      document({
        nodes: {
          start: callTrigger({ access: 'public' }),
          ret: { id: 'ret', type: 'task', action: 'flow.output', params: {} }
        }
      })
    );

    expect(messages(report.warnings)).toContain('signed-out visitors');
  });

  it('warns when the output step is not the last one', () => {
    const report = validateActionDocument(
      document({
        nodes: {
          start: callTrigger(),
          ret: { id: 'ret', type: 'task', action: 'flow.output', params: {}, afterNode: 'after' },
          after: { id: 'after', type: 'task', action: 'kv.set', params: {} }
        }
      })
    );

    expect(report.valid).toBe(true);
    expect(messages(report.warnings)).toContain('run for nothing');
  });

  it('warns when a step reads a credential it never asked for', () => {
    const report = validateActionDocument(
      document({
        nodes: {
          start: callTrigger(),
          ret: {
            id: 'ret',
            type: 'task',
            action: 'http.request',
            params: { url: 'https://x', headers: '{{ credential.api.token }}' }
          }
        }
      })
    );

    expect(messages(report.warnings)).toContain('resolves to nothing');
  });
});
