import { randomUUID } from 'node:crypto';

/**
 * The suite's mail sink: an SMTP server that keeps every message it is handed, and an HTTP route answering what it
 * kept. See `server/mailSink.ts`.
 *
 * SMTP on 5204 rather than 1025, so a Mailpit left running for development is never mistaken for it.
 */
export const MAIL_SINK = { smtpPort: 5204, origin: 'http://127.0.0.1:5203' };

export type MailAddress = { name: string; address: string };

export type ReceivedMail = { from: MailAddress; to: string; replyTo: string; subject: string; text: string };

/** A recipient nobody else in the run writes to, so what the sink holds for it is this test's mail and nobody else's. */
export const uniqueRecipient = (name: string): string => `${name}.${randomUUID()}@e2e.test`;

/**
 * What the sink received for one recipient.
 *
 * Nothing to wait for: `email.send` awaits the server accepting the message, and the sink accepts it only once it is
 * kept — so by the time a run has answered, its mail is already here or never will be.
 */
export const mailFor = async (to: string): Promise<ReceivedMail[]> => {
  const response = await fetch(`${MAIL_SINK.origin}/messages?to=${encodeURIComponent(to)}`);
  if (!response.ok) {
    throw new Error(`The mail sink answered ${response.status}`);
  }

  return (await response.json()) as ReceivedMail[];
};
