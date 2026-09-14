import type { ActionTask } from '../types';

/**
 * One address, and nothing a mail header could be split on.
 *
 * Stricter than the standard on purpose: a comma or a semicolon is how one recipient becomes a hundred, and a line
 * break is how a subject becomes a second header. A flow renders what a visitor typed, so this is where that stops.
 */
const ADDRESS = /^[^\s@,;<>"]+@[^\s@,;<>"]+\.[^\s@,;<>"]+$/;

const MAX_SUBJECT = 200;

const MAX_TEXT = 20_000;

type SendParams = { to: string; subject: string; text: string; replyTo: string };

/**
 * Sends one plain-text message through the transport the deployment configured.
 *
 * Offered only when there is one: a step whose only possible outcome is "this server cannot send mail" is worse
 * than no step. Everything a provider would need beyond the message — the sender, the domain, a sending cap — is
 * the adapter's, so nothing here lets a flow choose who the mail appears to come from.
 */
const send: ActionTask<SendParams> = {
  namespace: 'email',
  action: 'send',
  title: 'Send Email',
  description: 'Sends a plain-text message through the transport this deployment configured',
  params: {
    to: { type: 'text', canBind: true, defaultValue: '', label: 'To' },
    subject: { type: 'text', canBind: true, defaultValue: '', label: 'Subject' },
    text: { type: 'codemirror-text', canBind: true, defaultValue: '', label: 'Text' },
    replyTo: { type: 'text', canBind: true, defaultValue: '', label: 'Reply to' }
  },
  run: async ({ to, subject, text, replyTo }, ctx) => {
    if (!ctx.email) {
      throw new Error('This server has no email transport');
    }

    const recipient = to.trim();
    if (!ADDRESS.test(recipient)) {
      throw new Error('The recipient is not one email address');
    }

    const answerTo = replyTo.trim();
    if (answerTo !== '' && !ADDRESS.test(answerTo)) {
      throw new Error('The reply-to is not one email address');
    }

    const title = subject.trim();
    if (title === '' || /[\r\n]/.test(title) || title.length > MAX_SUBJECT) {
      throw new Error(`The subject must be one line of 1 to ${MAX_SUBJECT} characters`);
    }

    if (text.trim() === '' || text.length > MAX_TEXT) {
      throw new Error(`The text must have 1 to ${MAX_TEXT} characters`);
    }

    await ctx.email.send({
      spaceId: ctx.spaceId,
      to: recipient,
      subject: title,
      text,
      ...(answerTo === '' ? {} : { replyTo: answerTo })
    });

    return { sent: true };
  }
};

export const emailTasks = [send] as ActionTask<Record<string, unknown>>[];
