import { describe, expect, it, vi } from 'vitest';

import { createActionsModule } from '../index';

import type { ActionEmailAdapter } from '../types';
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

const lookups = { getAction: () => Promise.resolve(undefined) };

const run = (entry: ActionEntry, email?: ActionEmailAdapter) =>
  createActionsModule({ lookups, ...(email ? { email } : {}) }).runAction({
    entry,
    input: {},
    callerId: 'ip:198.51.100.7',
    spaceId: 3,
    environment: 'main',
    trigger: 'call',
    runId: 'run-1'
  });

const message = { to: 'ana@example.com', subject: 'Tu mesa', text: 'Te esperamos el jueves.' };

describe('email.send', () => {
  it('hands one plain-text message to the transport, for the space the run belongs to', async () => {
    const send = vi.fn(() => Promise.resolve());

    const result = await run(mailAction(message), { send });

    expect(result.status).toBe('completed');
    expect(send).toHaveBeenCalledWith({ spaceId: 3, ...message });
  });

  /** A flow renders what a visitor typed: a comma is a second recipient and a line break is a second header. */
  it('refuses more than one recipient, and a subject that is two lines', async () => {
    const send = vi.fn(() => Promise.resolve());

    const recipients = await run(mailAction({ ...message, to: 'ana@example.com, eve@example.com' }), { send });
    const subject = await run(mailAction({ ...message, subject: 'Tu mesa\nBcc: eve@example.com' }), { send });

    expect(recipients.status).toBe('failed');
    expect(subject.status).toBe('failed');
    expect(send).not.toHaveBeenCalled();
  });

  it('fails the step when the transport refuses the message', async () => {
    const send = vi.fn(() => Promise.reject(new Error('Daily sending cap reached')));

    const result = await run(mailAction(message), { send });

    expect(result.status).toBe('failed');
  });

  it('is offered only to a deployment that configured a transport', () => {
    const without = createActionsModule({ lookups });
    const withTransport = createActionsModule({ lookups, email: { send: () => Promise.resolve() } });

    expect(without.registry.get('email.send')).toBeUndefined();
    expect(withTransport.registry.get('email.send')).toBeDefined();
  });
});
