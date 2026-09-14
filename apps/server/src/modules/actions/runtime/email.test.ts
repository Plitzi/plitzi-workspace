import { describe, expect, it, vi } from 'vitest';

import { createEmailSender } from './email';
import { createKvStore } from './kvStore';
import { createMemoryKv } from './memoryKv';

import type { EmailSenderOptions } from './email';
import type { SmtpSettings } from '@plitzi/sdk-shared/actions';

const smtp: SmtpSettings = {
  host: 'smtp.example.test',
  port: 587,
  security: 'starttls',
  username: 'ana',
  password: 'secret-password',
  fromEmail: 'hola@example.test',
  fromName: 'Ceniza'
};

const message = { to: 'ana@example.test', subject: 'Tu mesa', text: 'Te esperamos.' };

const signal = new AbortController().signal;

const resolvesTo = (address: string) => vi.fn(() => Promise.resolve([{ address }]));

const sender = (overrides: Partial<EmailSenderOptions> = {}) => {
  const deliver = vi.fn(() => Promise.resolve());
  const email = createEmailSender({
    kv: createKvStore(createMemoryKv()),
    lookup: resolvesTo('203.0.113.10'),
    deliver,
    ...overrides
  });

  return { deliver, email };
};

describe('email sender', () => {
  /** Connecting by the address that was judged is what keeps a name that answers differently a second later out. */
  it('connects to the address it judged, with the server the credential names', async () => {
    const { deliver, email } = sender();

    await email.send(3, smtp, message, signal);

    expect(deliver).toHaveBeenCalledWith({ address: '203.0.113.10', smtp, message, signal });
  });

  it('refuses a host that resolves to a private network, unless the deployment allows it', async () => {
    const refused = sender({ lookup: resolvesTo('10.0.0.5') });
    const allowed = sender({ lookup: resolvesTo('10.0.0.5'), allowPrivateHosts: true });

    await expect(refused.email.send(3, smtp, message, signal)).rejects.toThrow('private network');
    await allowed.email.send(3, smtp, message, signal);

    expect(refused.deliver).not.toHaveBeenCalled();
    expect(allowed.deliver).toHaveBeenCalledTimes(1);
  });

  it('refuses localhost by name', async () => {
    const { deliver, email } = sender({ lookup: resolvesTo('127.0.0.1') });

    await expect(email.send(3, { ...smtp, host: 'localhost' }, message, signal)).rejects.toThrow('private network');
    expect(deliver).not.toHaveBeenCalled();
  });

  it('says so when the host does not resolve', async () => {
    const { email } = sender({ lookup: vi.fn(() => Promise.reject(new Error('ENOTFOUND'))) });

    await expect(email.send(3, smtp, message, signal)).rejects.toThrow('does not resolve');
  });

  /** A public action can be made to send to any address a visitor types; the limit is what stops a space relaying mail. */
  it('counts each space on its own and stops it at its daily limit', async () => {
    const { deliver, email } = sender({ dailyLimitPerSpace: 2 });

    await email.send(3, smtp, message, signal);
    await email.send(3, smtp, message, signal);
    await email.send(4, smtp, message, signal);

    await expect(email.send(3, smtp, message, signal)).rejects.toThrow('This space has sent its 2 emails for today');
    expect(deliver).toHaveBeenCalledTimes(3);
  });

  it('spends the allowance even when the server fails, so an outage cannot be retried past the limit', async () => {
    const { email } = sender({ dailyLimitPerSpace: 1, deliver: vi.fn(() => Promise.reject(new Error('421 busy'))) });

    await expect(email.send(3, smtp, message, signal)).rejects.toThrow('421 busy');
    await expect(email.send(3, smtp, message, signal)).rejects.toThrow('This space has sent its 1 emails for today');
  });
});
