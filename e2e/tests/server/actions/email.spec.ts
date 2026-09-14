import { describeTarget, expect, test } from '../../../fixtures';
import { mailFor, uniqueRecipient } from '../../../helpers/mail';
import { MAIL_ACTION, MAIL_FROM, UNCONFIGURED_MAIL_ACTION } from '../../../spaces';

import type { APIRequestContext } from '@playwright/test';

/**
 * `email.send`, the whole way out: a flow sends through the SMTP server its space holds as a credential, and that
 * server is the suite's mail sink — a real one, so what is checked is the message a mail client actually built.
 */

type RunAnswer = { status: string; trace?: unknown[] };

describeTarget('action-server', subject => {
  const run = async (request: APIRequestContext, actionId: string, input: Record<string, string>) => {
    const response = await request.post(`${subject.origin}/_action`, { data: { actionId, input } });
    expect(response.status()).toBe(200);

    return (await response.json()) as RunAnswer;
  };

  test('a flow sends through its space’s SMTP server, as that server’s sender', async ({ request }) => {
    const to = uniqueRecipient('ana');

    const answer = await run(request, MAIL_ACTION.id, { to, name: 'Ana' });

    expect(answer.status).toBe('completed');
    expect(await mailFor(to)).toEqual([
      { from: MAIL_FROM, to, replyTo: '', subject: 'Hello Ana', text: 'Sent by a flow for Ana.' }
    ]);
  });

  /** A flow renders what a visitor typed, and a line break in a subject is how a stranger adds a header of their own. */
  test('what a visitor typed cannot become a second header', async ({ request }) => {
    const to = uniqueRecipient('eve');

    const answer = await run(request, MAIL_ACTION.id, { to, name: 'Ana\nBcc: eve@e2e.test' });

    expect(answer.status).toBe('failed');
    expect(await mailFor(to)).toEqual([]);
  });

  /** Plitzi's own mail account is never the fallback: a space without an SMTP server of its own sends nothing. */
  test('a step that names no SMTP server fails, and says what is missing', async ({ request }) => {
    const to = uniqueRecipient('nobody');

    const answer = await run(request, UNCONFIGURED_MAIL_ACTION.id, { to, name: 'Ana' });

    expect(answer.status).toBe('failed');
    expect(JSON.stringify(answer.trace)).toContain('names no SMTP credential');
    expect(await mailFor(to)).toEqual([]);
  });
});

test.describe.configure({ mode: 'parallel' });
