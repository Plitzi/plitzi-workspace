import { lookup as dnsLookup } from 'node:dns/promises';

import { isBlockedHost } from '../../../helpers/outboundGuard';

import type { HostLookup } from '../../../helpers/outboundGuard';
import type { ActionKvStore } from '../types';
import type { ActionEmailConfig, ActionEmailMessage } from '@plitzi/sdk-shared';
import type { SmtpSettings } from '@plitzi/sdk-shared/actions';

export const DEFAULT_EMAIL_DAILY_LIMIT = 200;

const DAY_SECONDS = 24 * 60 * 60;

const CONNECTION_TIMEOUT_MS = 10_000;

const SOCKET_TIMEOUT_MS = 20_000;

/** Hands one message to the SMTP server of a space, at an address this module already resolved and judged. */
export type SmtpDelivery = (delivery: {
  /** The IP to connect to. The host name travels separately, as what the TLS certificate must be for. */
  address: string;
  smtp: SmtpSettings;
  message: ActionEmailMessage;
  signal: AbortSignal;
}) => Promise<void>;

/** What the `email.send` task sends through: the policy around a space's own SMTP server, and the connection. */
export type ActionEmailSender = {
  send: (spaceId: number, smtp: SmtpSettings, message: ActionEmailMessage, signal: AbortSignal) => Promise<void>;
};

export type EmailSenderOptions = ActionEmailConfig & {
  /** The server's own store, NOT a space's: a flow must not be able to reach the counter that limits it. */
  kv: ActionKvStore;
  lookup?: HostLookup;
  deliver?: SmtpDelivery;
  now?: () => Date;
};

const resolveAll: HostLookup = hostname => dnsLookup(hostname, { all: true, verbatim: true });

/** Loaded on the first message, so a server whose flows send no mail never loads a mail client to find that out. */
const deliverWithNodemailer: SmtpDelivery = async ({ address, smtp, message, signal }) => {
  const { createTransport } = await import('nodemailer');
  const transport = createTransport({
    host: address,
    port: smtp.port,
    secure: smtp.security === 'tls',
    requireTLS: smtp.security === 'starttls',
    ignoreTLS: smtp.security === 'none',
    // Connected by address, verified by name: the certificate is for the host the credential names, not for an IP.
    tls: { servername: smtp.host },
    ...(smtp.username ? { auth: { user: smtp.username, pass: smtp.password } } : {}),
    connectionTimeout: CONNECTION_TIMEOUT_MS,
    greetingTimeout: CONNECTION_TIMEOUT_MS,
    socketTimeout: SOCKET_TIMEOUT_MS
  });
  const abort = () => transport.close();
  signal.addEventListener('abort', abort, { once: true });

  try {
    await transport.sendMail({
      from: { name: smtp.fromName, address: smtp.fromEmail },
      to: message.to,
      subject: message.subject,
      text: message.text,
      ...(message.replyTo ? { replyTo: message.replyTo } : {})
    });
  } finally {
    signal.removeEventListener('abort', abort);
    transport.close();
  }
};

/**
 * Sends a flow's message through the SMTP server its space configured, under the deployment's rules.
 *
 * Three things happen before a byte reaches that server, in this order:
 *
 * 1. **The host is resolved and every address judged.** A credential is typed by a customer and the connection
 *    starts inside the deployment's network, so `localhost` or an address that resolves to `10.0.0.5` is refused
 *    unless the deployment allowed it. The connection then goes to the address that was judged, so a name that
 *    answers differently a second later cannot be how it gets in.
 * 2. **The message is counted against the space's day.** Before it leaves, and never given back: a failing server
 *    still spends the allowance, or retrying against an outage would be how the limit is walked past.
 * 3. **The message is delivered.**
 */
export const createEmailSender = ({
  kv,
  dailyLimitPerSpace = DEFAULT_EMAIL_DAILY_LIMIT,
  allowPrivateHosts = false,
  lookup = resolveAll,
  deliver = deliverWithNodemailer,
  now = () => new Date()
}: EmailSenderOptions): ActionEmailSender => ({
  send: async (spaceId, smtp, message, signal) => {
    let addresses: { address: string }[];
    try {
      addresses = await lookup(smtp.host);
    } catch {
      throw new Error(`The SMTP host "${smtp.host}" does not resolve`);
    }

    const [first] = addresses;
    if (addresses.length === 0) {
      throw new Error(`The SMTP host "${smtp.host}" does not resolve`);
    }

    if (!allowPrivateHosts && (isBlockedHost(smtp.host) || addresses.some(({ address }) => isBlockedHost(address)))) {
      throw new Error(`The SMTP host "${smtp.host}" is on a private network, which this server does not connect to`);
    }

    const day = now().toISOString().slice(0, 10);
    // `email-limit:` and not anything under `action:<spaceId>:`, which is where every key a flow writes is prefixed.
    const sent = await kv.increment(`email-limit:${spaceId}:${day}`, 1, 2 * DAY_SECONDS);
    if (sent > dailyLimitPerSpace) {
      throw new Error(`This space has sent its ${dailyLimitPerSpace} emails for today`);
    }

    await deliver({ address: first.address, smtp, message, signal });
  }
});
