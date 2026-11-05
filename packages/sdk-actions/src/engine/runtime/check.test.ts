import { describe, expect, it } from 'vitest';

import { checkAction } from './check';
import { createTaskRegistry } from '../tasks/registry';

import type { ActionCheckDeps } from './check';
import type { ActionEntry, ElementInteraction } from '@plitzi/sdk-shared';

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

const entry = (nodes: Record<string, ElementInteraction>): ActionEntry => ({
  id: 'checkout',
  document: { name: 'Checkout', nodes }
});

const deps = (overrides: Partial<ActionCheckDeps> = {}): ActionCheckDeps => ({
  spaceId: 1,
  registry: createTaskRegistry([], { db: true }),
  lookups: {
    getAction: () => Promise.resolve(undefined),
    getCredential: (_spaceId, identifier) =>
      Promise.resolve(identifier === 'stripe' ? { hookSecret: 'whsec', secret: '' } : undefined),
    getConnector: (_spaceId, connectorId) => Promise.resolve(connectorId === 'cms' ? ({} as never) : undefined)
  },
  ...overrides
});

const messages = (issues: { message: string }[]) => issues.map(issue => issue.message).join(' | ');

describe('checkAction', () => {
  /** The failure that shows up at 3am on the first real delivery: the document is fine, the space is not. */
  it('names a credential the space has not got', async () => {
    const report = await checkAction(
      entry({ call: node('call', { action: 'http.request', params: { url: 'https://x.test', credential: 'ghost' } }) }),
      deps()
    );

    expect(report.valid).toBe(false);
    expect(messages(report.issues)).toContain('no credential called "ghost"');
  });

  /** A credential that exists but does not carry the key the step reads is the same failure one level down. */
  it('names a key missing from the credential the webhook signs with', async () => {
    const report = await checkAction(
      entry({
        start: node('start', {
          type: 'trigger',
          action: 'webhook',
          params: { access: 'public', signatureCredential: 'stripe', signatureSecretField: 'nope' }
        })
      }),
      deps()
    );

    expect(messages(report.issues)).toContain('has no key called "nope"');
  });

  /** Present and EMPTY is worse than absent: the endpoint looks protected and verifies against nothing. */
  it('refuses a signing key that is there and empty', async () => {
    const report = await checkAction(
      entry({
        start: node('start', {
          type: 'trigger',
          action: 'webhook',
          params: { access: 'public', signatureCredential: 'stripe' }
        })
      }),
      deps()
    );

    expect(report.valid).toBe(false);
    expect(messages(report.issues)).toContain('is empty');
  });

  it('warns that an unsigned webhook is an open endpoint, without calling it broken', async () => {
    const report = await checkAction(
      entry({ start: node('start', { type: 'trigger', action: 'webhook', params: { access: 'public' } }) }),
      deps()
    );

    expect(report.valid, 'an unsigned webhook is a choice, not a contradiction').toBe(true);
    expect(report.issues[0]).toMatchObject({ level: 'warning' });
  });

  it('refuses a cron this server would never fire', async () => {
    const report = await checkAction(
      entry({ start: node('start', { type: 'trigger', action: 'schedule', params: { cron: 'every tuesday' } }) }),
      deps()
    );

    expect(report.valid).toBe(false);
    expect(messages(report.issues)).toContain('not an expression this server can fire');
  });

  /** The catalog is SERVED: a step that works on one deployment is a broken promise on another. */
  it('names a task this deployment does not register, and says what it does', async () => {
    const report = await checkAction(entry({ put: node('put', { action: 'storage.put' }) }), deps());

    expect(messages(report.issues)).toContain('no task called "storage.put"');
    expect(report.issues[0].hint).toContain('http.request');
  });

  /** Without a credential there is nobody's server to send through: the first booking is where it would surface. */
  it('refuses an email step that names no SMTP credential, and one that is not an SMTP server', async () => {
    const unnamed = await checkAction(entry({ send: node('send', { action: 'email.send' }) }), deps());
    const wrongKind = await checkAction(
      entry({ send: node('send', { action: 'email.send', params: { credential: 'stripe' } }) }),
      deps()
    );

    expect(messages(unnamed.issues)).toContain('names no SMTP server');
    expect(messages(wrongKind.issues)).toContain('not a usable SMTP server');
  });

  it('accepts an email step whose credential is a usable SMTP server', async () => {
    const smtp = {
      host: 'smtp.example.test',
      port: '587',
      security: 'starttls',
      username: 'ana',
      password: 'secret',
      fromEmail: 'hola@example.test',
      fromName: 'Ceniza'
    };
    const report = await checkAction(
      entry({ send: node('send', { action: 'email.send', params: { credential: 'smtp' } }) }),
      deps({ lookups: { getAction: () => Promise.resolve(undefined), getCredential: () => Promise.resolve(smtp) } })
    );

    expect(report.issues).toEqual([]);
  });

  it('refuses a database engine this server drives no connection for', async () => {
    const report = await checkAction(
      entry({ read: node('read', { action: 'db.query', params: { credential: 'db', sql: 'select 1' } }) }),
      deps({
        lookups: {
          getAction: () => Promise.resolve(undefined),
          getCredential: () => Promise.resolve({ engine: 'postgres', dsn: 'postgres://x' })
        },
        dbDrivers: [{ engine: 'mysql', query: () => Promise.resolve([]) }]
      })
    );

    expect(report.valid).toBe(false);
    expect(messages(report.issues)).toContain('no driver for "postgres"');
  });

  /** A template resolves at run time against values the check does not have. Reporting it as missing would be
   *  an error about something that is right. */
  it('says nothing about a credential named by a binding', async () => {
    const report = await checkAction(
      entry({
        call: node('call', {
          action: 'http.request',
          params: { url: 'https://x.test', credential: '{{ input.which }}' }
        })
      }),
      deps()
    );

    expect(report.issues).toEqual([]);
  });

  it('passes a flow whose every reference resolves', async () => {
    const report = await checkAction(
      entry({
        start: node('start', {
          type: 'trigger',
          action: 'webhook',
          params: { access: 'public', signatureCredential: 'stripe', signatureSecretField: 'hookSecret' }
        }),
        read: node('read', { action: 'connector.read', params: { connector: 'cms' } })
      }),
      deps()
    );

    expect(report).toEqual({ valid: true, issues: [] });
  });
});
