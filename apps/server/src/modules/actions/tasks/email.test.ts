import { beforeEach, describe, expect, it, vi } from 'vitest';

import { createActionsModule } from '../index';

import type { ActionEntry, ElementInteraction } from '@plitzi/sdk-shared';

const { sendMail, lookup } = vi.hoisted(() => ({
  sendMail: vi.fn(() => Promise.resolve({})),
  lookup: vi.fn(() => Promise.resolve([{ address: '203.0.113.10', family: 4 }]))
}));

vi.mock('nodemailer', () => ({ createTransport: vi.fn(() => ({ sendMail, close: vi.fn() })) }));

vi.mock('node:dns/promises', () => ({ lookup }));

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

const mailAction = (params: Record<string, string>): ActionEntry => ({
  id: 'mail',
  document: {
    name: 'Mail',
    output: { sent: { type: 'boolean' } },
    nodes: {
      start: node('start', { type: 'trigger', action: 'call', params: { access: 'public' }, afterNode: 'send' }),
      send: node('send', { action: 'email.send', params, beforeNode: 'start' })
    }
  }
});

const SMTP = {
  host: 'smtp.example.test',
  port: '587',
  security: 'starttls',
  username: 'ana',
  password: 'secret-password',
  fromEmail: 'hola@example.test',
  fromName: 'Ceniza'
};

const credentials: Record<string, Record<string, string>> = { 'smtp-main': SMTP, 'not-smtp': { token: 'abc' } };

const lookups = {
  getAction: () => Promise.resolve(undefined),
  getCredential: (_spaceId: number, identifier: string) => Promise.resolve(credentials[identifier])
};

const run = (entry: ActionEntry) =>
  createActionsModule({ lookups }).runAction({
    entry,
    input: {},
    callerId: 'ip:198.51.100.7',
    spaceId: 3,
    environment: 'main',
    trigger: 'call',
    runId: 'run-1'
  });

const message = { credential: 'smtp-main', to: 'ana@example.test', subject: 'Tu mesa', text: 'Te esperamos.' };

describe('email.send', () => {
  beforeEach(() => {
    sendMail.mockClear();
  });

  it('sends through the SMTP server the step names, as the sender that server is for', async () => {
    const result = await run(mailAction(message));

    expect(result.status).toBe('completed');
    expect(sendMail).toHaveBeenCalledWith(
      expect.objectContaining({
        from: { name: 'Ceniza', address: 'hola@example.test' },
        to: 'ana@example.test',
        subject: 'Tu mesa',
        text: 'Te esperamos.'
      })
    );
  });

  it('refuses a step that names no SMTP server, and a credential that is not one', async () => {
    const unnamed = await run(mailAction({ ...message, credential: '' }));
    const wrongKind = await run(mailAction({ ...message, credential: 'not-smtp' }));

    expect(unnamed.status).toBe('failed');
    expect(wrongKind.status).toBe('failed');
    expect(sendMail).not.toHaveBeenCalled();
  });

  /** A flow renders what a visitor typed: a comma is a second recipient and a line break is a second header. */
  it('refuses more than one recipient, and a subject that is two lines', async () => {
    const recipients = await run(mailAction({ ...message, to: 'ana@example.test, eve@example.test' }));
    const subject = await run(mailAction({ ...message, subject: 'Tu mesa\nBcc: eve@example.test' }));

    expect(recipients.status).toBe('failed');
    expect(subject.status).toBe('failed');
    expect(sendMail).not.toHaveBeenCalled();
  });

  it('keeps the server password out of the trace, even when the server refuses the message', async () => {
    sendMail.mockImplementationOnce(() => Promise.reject(new Error('535 bad credentials for ana:secret-password')));

    const result = await run(mailAction(message));

    expect(result.status).toBe('failed');
    expect(JSON.stringify(result.trace)).not.toContain('secret-password');
  });

  /** The host is a value of the credential, so a trace redacts it: the failure names the credential instead. */
  it('says which SMTP credential could not send, in words the trace does not redact', async () => {
    lookup.mockImplementationOnce(() => Promise.resolve([{ address: '10.0.0.5', family: 4 }]));

    const result = await run(mailAction(message));
    const failure = result.trace.find(step => step.node.id === 'error')?.result;

    expect(result.status).toBe('failed');
    expect(failure).toEqual({
      error:
        'Could not send through the SMTP credential "smtp-main": its SMTP host is on a private network, which this server does not connect to'
    });
    expect(JSON.stringify(result.trace)).not.toContain('«redacted»');
    expect(sendMail).not.toHaveBeenCalled();
  });

  it('is offered by every server, with nothing to configure', () => {
    expect(createActionsModule({ lookups }).registry.get('email.send')).toBeDefined();
  });
});
