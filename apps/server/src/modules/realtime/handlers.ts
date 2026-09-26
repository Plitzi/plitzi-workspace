import { randomBytes, randomUUID } from 'node:crypto';

import { accessRefusal } from '@plitzi/sdk-shared/actions';
import { PRESENCE_TYPE, channelLimits, matchChannel } from '@plitzi/sdk-shared/realtime';

import { openEventStream } from '../../core/http/sse';
import { onAbort } from '../../helpers/onAbort';

import type { ChannelResolver } from './declarations';
import type { RealtimeConnection, RealtimeHub } from './hub';
import type { RawResponse } from '../../helpers/buildResponseHelpers';
import type { ChannelDeclaration, RealtimePublishRequest, SSRRequest, SSRResponseHelpers } from '@plitzi/sdk-shared';

/** Topics one connection may hold. A page shows a handful; past this it is somebody enumerating. */
const MAX_TOPICS = 8;

/** A type a page may send: its own vocabulary, never one of the channel's `$` types but `$presence`. */
const TYPE = /^[A-Za-z0-9_.:-]{1,64}$/;

/** How long a disconnected client waits before trying again — ours reconnects itself; this is for anyone else's. */
const RETRY_MS = 3000;

export type RealtimeRefusal = { topic: string; reason: 'undeclared' | 'unauthenticated' | 'forbidden' };

const json = (res: SSRResponseHelpers, status: number, payload: Record<string, unknown>): void => {
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
 * Each topic is checked against the channels the space declares and against the visitor's access before the stream
 * opens; one that fails is reported, not a reason to refuse the rest. The first event, `ready`, tells the page its
 * public name (`from`) and the secret its publishes carry. Resolves when the page goes.
 */
export const handleRealtimeSubscribe = async ({
  req,
  res,
  raw,
  signal,
  hub,
  resolveChannels
}: SubscribeDeps): Promise<void> => {
  const { environment = 'main', spaceId, revision } = req.ctx.spaceDeployment ?? {};
  if (typeof spaceId !== 'number') {
    json(res, 404, { error: 'No space is served here', reason: 'not_found' });

    return;
  }

  const requested = topicsOf(req.query);
  if (requested.length === 0 || requested.length > MAX_TOPICS) {
    json(res, 422, { error: `Name between 1 and ${MAX_TOPICS} topics: ?topics=a,b`, reason: 'invalid_input' });

    return;
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
    json(res, 403, { error: 'None of these topics may be opened here', reason: 'forbidden', refused });

    return;
  }

  let finish = (): void => undefined;
  const gone = new Promise<void>(resolve => {
    finish = resolve;
  });
  const stream = openEventStream(raw, { onAbort: () => finish(), retryMs: RETRY_MS });
  const { user } = req.ctx;
  const connection: RealtimeConnection = {
    id: randomUUID(),
    token: randomBytes(24).toString('base64url'),
    space: { spaceId, environment },
    ...(user ? { user: { id: user.id, name: user.username } } : {}),
    topics: accepted,
    announced: new Set(),
    sent: new Map(),
    send: stream.send
  };

  const release = onAbort(signal, () => finish());
  stream.send('ready', { connection: connection.id, token: connection.token, topics: [...accepted.keys()], refused });
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

/** Whether this connection may send one more message on `topic` this second. */
const withinRate = (connection: RealtimeConnection, topic: string, perSecond: number): boolean => {
  const second = Math.floor(Date.now() / 1000);
  const sent = connection.sent.get(topic);
  const count = sent?.second === second ? sent.count + 1 : 1;
  connection.sent.set(topic, { second, count });

  return count <= perSecond;
};

/**
 * `POST /_realtime` `{ token, topic, type, data }` — a page publishing.
 *
 * Only on a topic its connection subscribed to, only on a channel pages may send on, within its size and its rate —
 * and stamped by the server with who sent it and when, whatever the body said.
 */
export const handleRealtimePublish = async ({ req, res, hub }: PublishDeps): Promise<void> => {
  const body = parseBody(req.body);
  const connection = typeof body?.token === 'string' ? hub.find(body.token) : undefined;
  if (!body || !connection) {
    json(res, 401, {
      error: 'Not connected: open /_realtime first and publish with its token',
      reason: 'not_connected'
    });

    return;
  }

  const topic = typeof body.topic === 'string' ? body.topic : '';
  const declaration = connection.topics.get(topic);
  if (!declaration) {
    json(res, 403, { error: `This connection did not subscribe to "${topic}"`, reason: 'not_subscribed' });

    return;
  }

  if (declaration.publish === 'server') {
    json(res, 403, { error: `Only the server publishes on "${topic}"`, reason: 'server_only' });

    return;
  }

  const type = typeof body.type === 'string' ? body.type : '';
  const presence = type === PRESENCE_TYPE && declaration.presence === true;
  if (!presence && !TYPE.test(type)) {
    json(res, 422, { error: 'A message type is 1-64 of A-Z a-z 0-9 _ . : -', reason: 'invalid_input' });

    return;
  }

  const limits = channelLimits(declaration);
  const data: unknown = body.data ?? null;
  if (Buffer.byteLength(JSON.stringify(data)) > limits.maxMessageBytes) {
    json(res, 413, {
      error: `A message on "${topic}" is at most ${limits.maxMessageBytes} bytes`,
      reason: 'too_large'
    });

    return;
  }

  if (!withinRate(connection, topic, limits.messagesPerSecond)) {
    json(res, 429, { error: `At most ${limits.messagesPerSecond} messages a second`, reason: 'rate_limited' });

    return;
  }

  if (presence) {
    connection.announced.add(topic);
  }

  await hub.publish(connection.space, hub.from(connection, topic, type, data));
  res.setStatus(204);
  res.send('');
};
