import { randomBytes, randomUUID } from 'node:crypto';

import { accessRefusal } from '@plitzi/sdk-shared/actions';
import { PRESENCE_TYPE, channelLimits, matchChannel } from '@plitzi/sdk-shared/realtime';

import { openEventStream } from '../../core/http/sse';
import { onAbort } from '../../helpers/onAbort';

import type { ChannelResolver } from './declarations';
import type { RealtimeConnection, RealtimeHub, RealtimeSpace } from './hub';
import type { RawResponse } from '../../helpers/buildResponseHelpers';
import type {
  ChannelDeclaration,
  RealtimePublishRequest,
  RealtimeSender,
  SSRRequest,
  SSRResponseHelpers
} from '@plitzi/sdk-shared';

/** Topics one connection may hold. A page shows a handful; past this it is somebody enumerating. */
const MAX_TOPICS = 8;

/** A type a page may send: its own vocabulary, never one of the channel's `$` types but `$presence`. */
const TYPE = /^[A-Za-z0-9_.:-]{1,64}$/;

/** How long a disconnected client waits before trying again — ours reconnects itself; this is for anyone else's. */
const RETRY_MS = 3000;

export type RealtimeRefusal = { topic: string; reason: 'undeclared' | 'unauthenticated' | 'forbidden' };

/** An answer in HTTP terms, whichever transport carries it: a status, and what went wrong when something did. */
export type RealtimeAnswer = { status: number; error?: string; reason?: string; refused?: RealtimeRefusal[] };

export const answer = (res: SSRResponseHelpers, { status, ...payload }: RealtimeAnswer): void => {
  res.setStatus(status);
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.send(JSON.stringify(payload));
};

const topicsOf = (query: Record<string, string>): string[] => [
  ...new Set(
    (Object.hasOwn(query, 'topics') ? query.topics : '')
      .split(',')
      .map(topic => topic.trim())
      .filter(Boolean)
  )
];

/** What a page may open, decided once for either transport. */
export type Admission =
  | { ok: false; answer: RealtimeAnswer }
  | {
      ok: true;
      space: RealtimeSpace;
      user?: RealtimeSender['user'];
      accepted: Map<string, ChannelDeclaration>;
      refused: RealtimeRefusal[];
    };

/**
 * Which of the topics a page asked for (`?topics=a,b`) it may open: each checked against the channels the space
 * declares and against the visitor's access. One that fails is reported, not a reason to refuse the rest; all failing
 * is a `403`.
 */
export const admit = async (req: SSRRequest, resolveChannels: ChannelResolver): Promise<Admission> => {
  const { environment = 'main', spaceId, revision } = req.ctx.spaceDeployment ?? {};
  if (typeof spaceId !== 'number') {
    return { ok: false, answer: { status: 404, error: 'No space is served here', reason: 'not_found' } };
  }

  const requested = topicsOf(req.query);
  if (requested.length === 0 || requested.length > MAX_TOPICS) {
    return {
      ok: false,
      answer: { status: 422, error: `Name between 1 and ${MAX_TOPICS} topics: ?topics=a,b`, reason: 'invalid_input' }
    };
  }

  const channels = await resolveChannels(spaceId, environment, revision);
  const accepted = new Map<string, ChannelDeclaration>();
  const refused: RealtimeRefusal[] = [];
  for (const topic of requested) {
    const match = matchChannel(topic, channels);
    const refusal = match ? accessRefusal(match.declaration.access, req.ctx.user) : 'undeclared';
    if (match && !refusal) {
      accepted.set(topic, match.declaration);
    } else {
      refused.push({ topic, reason: refusal ?? 'undeclared' });
    }
  }

  if (accepted.size === 0) {
    return {
      ok: false,
      answer: { status: 403, error: 'None of these topics may be opened here', reason: 'forbidden', refused }
    };
  }

  const { user } = req.ctx;

  return {
    ok: true,
    space: { spaceId, environment },
    ...(user ? { user: { id: user.id, name: user.username } } : {}),
    accepted,
    refused
  };
};

/** A new connection for what was admitted, speaking through `send`. */
export const connectionFor = (
  admission: Extract<Admission, { ok: true }>,
  send: RealtimeConnection['send']
): RealtimeConnection => ({
  id: randomUUID(),
  token: randomBytes(24).toString('base64url'),
  space: admission.space,
  ...(admission.user ? { user: admission.user } : {}),
  topics: admission.accepted,
  announced: new Set(),
  sent: new Map(),
  send
});

/** Whether this connection may send one more message on `topic` this second. */
const withinRate = (connection: RealtimeConnection, topic: string, perSecond: number): boolean => {
  const second = Math.floor(Date.now() / 1000);
  const sent = connection.sent.get(topic);
  const count = sent?.second === second ? sent.count + 1 : 1;
  connection.sent.set(topic, { second, count });

  return count <= perSecond;
};

/**
 * A page publishing, whichever way it arrived: only on a topic its connection subscribed to, only on a channel pages
 * may send on, within its size and its rate — and stamped by the server with who sent it and when, whatever the
 * message said.
 */
export const publishFrom = async (
  hub: RealtimeHub,
  connection: RealtimeConnection,
  { topic, type, data }: { topic?: unknown; type?: unknown; data?: unknown }
): Promise<RealtimeAnswer> => {
  const name = typeof topic === 'string' ? topic : '';
  const declaration = connection.topics.get(name);
  if (!declaration) {
    return { status: 403, error: `This connection did not subscribe to "${name}"`, reason: 'not_subscribed' };
  }

  if (declaration.publish === 'server') {
    return { status: 403, error: `Only the server publishes on "${name}"`, reason: 'server_only' };
  }

  const kind = typeof type === 'string' ? type : '';
  const presence = kind === PRESENCE_TYPE && declaration.presence === true;
  if (!presence && !TYPE.test(kind)) {
    return { status: 422, error: 'A message type is 1-64 of A-Z a-z 0-9 _ . : -', reason: 'invalid_input' };
  }

  const limits = channelLimits(declaration);
  const value: unknown = data ?? null;
  if (Buffer.byteLength(JSON.stringify(value)) > limits.maxMessageBytes) {
    return {
      status: 413,
      error: `A message on "${name}" is at most ${limits.maxMessageBytes} bytes`,
      reason: 'too_large'
    };
  }

  if (!withinRate(connection, name, limits.messagesPerSecond)) {
    return { status: 429, error: `At most ${limits.messagesPerSecond} messages a second`, reason: 'rate_limited' };
  }

  if (presence) {
    connection.announced.add(name);
  }

  await hub.publish(connection.space, hub.from(connection, name, kind, value));

  return { status: 204 };
};

export type SubscribeDeps = {
  req: SSRRequest;
  res: SSRResponseHelpers;
  raw: RawResponse;
  signal: AbortSignal;
  hub: RealtimeHub;
  resolveChannels: ChannelResolver;
};

/**
 * `GET /_realtime?topics=a,b` — one Server-Sent Events connection for every topic a page listens to.
 *
 * The first event, `ready`, tells the page its public name (`from`) and the secret its publishes carry. Resolves when
 * the page goes.
 */
export const handleRealtimeSubscribe = async ({
  req,
  res,
  raw,
  signal,
  hub,
  resolveChannels
}: SubscribeDeps): Promise<void> => {
  const admission = await admit(req, resolveChannels);
  if (!admission.ok) {
    answer(res, admission.answer);

    return;
  }

  let finish = (): void => undefined;
  const gone = new Promise<void>(resolve => {
    finish = resolve;
  });
  const stream = openEventStream(raw, { onAbort: () => finish(), retryMs: RETRY_MS });
  const connection = connectionFor(admission, stream.send);

  const release = onAbort(signal, () => finish());
  stream.send('ready', {
    connection: connection.id,
    token: connection.token,
    topics: [...admission.accepted.keys()],
    refused: admission.refused
  });
  await hub.connect(connection);

  await gone;
  release();
  stream.close();
  await hub.disconnect(connection);
};

export type PublishDeps = { req: SSRRequest; res: SSRResponseHelpers; hub: RealtimeHub };

const parseBody = (body: string | undefined): Partial<RealtimePublishRequest> | undefined => {
  try {
    const value: unknown = body ? JSON.parse(body) : undefined;

    return typeof value === 'object' && value !== null ? value : undefined;
  } catch {
    return undefined;
  }
};

/** `POST /_realtime` `{ token, topic, type, data }` — a page on a Server-Sent Events connection, publishing. */
export const handleRealtimePublish = async ({ req, res, hub }: PublishDeps): Promise<void> => {
  const body = parseBody(req.body);
  const connection = typeof body?.token === 'string' ? hub.find(body.token) : undefined;
  if (!body || !connection) {
    answer(res, {
      status: 401,
      error: 'Not connected: open /_realtime first and publish with its token',
      reason: 'not_connected'
    });

    return;
  }

  const result = await publishFrom(hub, connection, body);
  if (result.status === 204) {
    res.setStatus(204);
    res.send('');

    return;
  }

  answer(res, result);
};
