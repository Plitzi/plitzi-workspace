import { createServer } from 'node:http';

import { simpleParser } from 'mailparser';
import { SMTPServer } from 'smtp-server';

import { MAIL_SINK } from '../helpers/mail';

import type { MailAddress, ReceivedMail } from '../helpers/mail';
import type { AddressObject } from 'mailparser';

/**
 * The SMTP server the suite's spaces send through: what a flow's `email.send` really sends, kept so a spec can read it
 * back.
 *
 * A real SMTP server rather than a stubbed transport, because the thing under test is the whole way out — the space's
 * credential read and judged, the connection, the message as a mail client builds it. Messages live in memory for the
 * life of the process and are never delivered anywhere.
 */

const PORT = Number(new URL(MAIL_SINK.origin).port);

const inbox: ReceivedMail[] = [];

const firstAddress = (field?: AddressObject | AddressObject[]): MailAddress => {
  const group = Array.isArray(field) ? field.at(0) : field;
  const entry = group?.value.at(0);

  return { name: entry?.name ?? '', address: entry?.address ?? '' };
};

const smtp = new SMTPServer({
  // The credentials the suite writes carry no user: a relay that trusts where the connection comes from.
  authOptional: true,
  disabledCommands: ['STARTTLS'],
  logger: false,
  onData: (stream, _session, callback) => {
    // Accepted only once it is kept, so the sender's "sent" means a spec can already read it.
    simpleParser(stream).then(
      mail => {
        inbox.push({
          from: firstAddress(mail.from),
          to: firstAddress(mail.to).address,
          replyTo: firstAddress(mail.replyTo).address,
          subject: mail.subject ?? '',
          text: (mail.text ?? '').trim()
        });
        callback();
      },
      (error: unknown) => callback(error instanceof Error ? error : new Error(String(error)))
    );
  }
});

smtp.listen(MAIL_SINK.smtpPort, '127.0.0.1');

createServer((req, res) => {
  const url = new URL(req.url ?? '/', MAIL_SINK.origin);
  if (req.method !== 'GET' || url.pathname !== '/messages') {
    res.writeHead(404).end();

    return;
  }

  const to = url.searchParams.get('to');
  res.writeHead(200, { 'content-type': 'application/json' });
  res.end(JSON.stringify(to === null ? inbox : inbox.filter(mail => mail.to === to)));
}).listen(PORT, '127.0.0.1');

console.log(`[e2e] mail sink: SMTP on 127.0.0.1:${MAIL_SINK.smtpPort}, what it kept on ${MAIL_SINK.origin}/messages`);
