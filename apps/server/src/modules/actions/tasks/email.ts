import { isSingleEmailAddress, readSmtpCredential } from '@plitzi/sdk-shared/actions';

import type { ActionTask } from '../types';

const MAX_SUBJECT = 200;

const MAX_TEXT = 20_000;

type SendParams = { credential: string; to: string; subject: string; text: string; replyTo: string };

/**
 * Sends one plain-text message through the SMTP server the space configured, as a credential.
 *
 * The server is the space's own, so is the sender: who the mail comes from is the credential's `fromEmail`, never a
 * parameter a flow renders. What is the same everywhere is checked here — exactly one recipient, a one-line subject,
 * plain text, sane sizes — because a flow renders what a visitor typed. What the deployment decides, how much one
 * space may send and where a connection may go, is `ctx.email`'s.
 */
const send: ActionTask<SendParams> = {
  namespace: 'email',
  action: 'send',
  title: 'Send Email',
  description: 'Sends a plain-text message through an SMTP server this space holds as a credential',
  params: {
    credential: {
      type: 'text',
      canBind: false,
      defaultValue: '',
      label: 'SMTP server (credential)',
      credentialProvider: 'smtp'
    },
    to: { type: 'text', canBind: true, defaultValue: '', label: 'To' },
    subject: { type: 'text', canBind: true, defaultValue: '', label: 'Subject' },
    text: { type: 'codemirror-text', canBind: true, defaultValue: '', label: 'Text' },
    replyTo: { type: 'text', canBind: true, defaultValue: '', label: 'Reply to' }
  },
  run: async ({ credential, to, subject, text, replyTo }, ctx) => {
    const identifier = credential.trim();
    if (identifier === '') {
      throw new Error('This step names no SMTP credential to send through — add one in Credentials and pick it here');
    }

    const recipient = to.trim();
    if (!isSingleEmailAddress(recipient)) {
      throw new Error('The recipient is not one email address');
    }

    const answerTo = replyTo.trim();
    if (answerTo !== '' && !isSingleEmailAddress(answerTo)) {
      throw new Error('The reply-to is not one email address');
    }

    const title = subject.trim();
    if (title === '' || /[\r\n]/.test(title) || title.length > MAX_SUBJECT) {
      throw new Error(`The subject must be one line of 1 to ${MAX_SUBJECT} characters`);
    }

    if (text.trim() === '' || text.length > MAX_TEXT) {
      throw new Error(`The text must have 1 to ${MAX_TEXT} characters`);
    }

    const stored = await ctx.credential(identifier);
    if (!stored) {
      throw new Error(`This space has no SMTP credential called "${identifier}" — add it in Credentials`);
    }

    const reading = readSmtpCredential(stored);
    if (!('settings' in reading)) {
      throw new Error(
        `Credential "${identifier}" is not a usable SMTP server: ${reading.problems.map(problem => `${problem.key} — ${problem.message}`).join('; ')}`
      );
    }

    await ctx.email.send(
      ctx.spaceId,
      reading.settings,
      { to: recipient, subject: title, text, ...(answerTo === '' ? {} : { replyTo: answerTo }) },
      ctx.signal
    );

    return { sent: true };
  }
};

export const emailTasks = [send] as ActionTask<Record<string, unknown>>[];
