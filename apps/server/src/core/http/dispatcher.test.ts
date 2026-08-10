import { describe, expect, it } from 'vitest';

import { makeHandler } from './dispatcher';

import type { BuildContext } from './dispatcher';
import type { BaseContext, Stage } from './types';
import type { RawResponse } from '../../helpers/buildResponseHelpers';
import type { ServerLogEvent, ServerRequestLogEvent, SSRServerConfig } from '@plitzi/sdk-shared';
import type { IncomingMessage } from 'node:http';

const fakeRequest = (url: string, method = 'GET'): IncomingMessage =>
  ({ url, method, headers: { host: 'example.test' }, socket: {} }) as unknown as IncomingMessage;

// A request as it arrives through the proxy chain: forwarding headers plus the socket peer underneath them.
const fakeClientRequest = (headers: Record<string, string>, remoteAddress?: string): IncomingMessage =>
  ({
    url: '/',
    method: 'GET',
    headers: { host: 'example.test', ...headers },
    socket: { remoteAddress }
  }) as unknown as IncomingMessage;

const fakeResponse = (): RawResponse => ({
  headersSent: false,
  statusCode: 200,
  setHeader: () => undefined,
  getHeaders: () => ({}),
  writeHead(status: number) {
    this.statusCode = status;
    this.headersSent = true;

    return undefined;
  },
  write: () => undefined,
  end: () => undefined
});

// Drives one request through the dispatcher with the given stages and returns what the logger saw.
const run = async (raw: IncomingMessage, stages: Stage[], rawRes: RawResponse = fakeResponse()) => {
  const events: ServerLogEvent[] = [];
  const config = { adapters: {}, logger: (event: ServerLogEvent) => events.push(event) };
  const buildContext: BuildContext<BaseContext> = (rawReq, res, req, helpers) => ({
    raw: rawReq,
    rawRes: res,
    req,
    res: helpers,
    config: config as unknown as SSRServerConfig,
    port: 0
  });

  makeHandler('SSR', buildContext, stages)(raw, rawRes);
  await new Promise(resolve => setTimeout(resolve, 0));

  return events;
};

const answer = (status: number): Stage => {
  return ctx => {
    ctx.res.setStatus(status);
    ctx.res.end();

    return true;
  };
};

// The dispatcher only ever emits request events; narrowing here keeps every assertion typed against that shape.
const firstRequest = (events: ServerLogEvent[]): ServerRequestLogEvent => {
  const [event] = events;
  if (event.kind !== 'request') {
    throw new Error(`expected a request event, got ${event.kind}`);
  }

  return event;
};

describe('dispatcher request log', () => {
  it('logs the request the answering stage served', async () => {
    const events = await run(fakeRequest('/pricing'), [answer(200)]);

    expect(events).toHaveLength(1);
    expect(firstRequest(events)).toMatchObject({
      server: 'SSR',
      method: 'GET',
      path: '/pricing',
      status: 200,
      ok: true
    });
    expect(firstRequest(events).durationMs).toBeGreaterThanOrEqual(0);
  });

  it('keeps query keys but drops their values, which may carry personal data', async () => {
    const events = await run(fakeRequest('/search?email=ada@example.com&page=2'), [answer(200)]);

    expect(firstRequest(events).path).toBe('/search?email&page');
  });

  // A 4xx is an answer, not a fault. Flagging them as errors buried the ones that mean something under Chrome
  // probing /.well-known on every devtools open and under every signed-out visitor; the status is on the line
  // either way, so nothing is hidden by saying the server did not go wrong.
  it('does not call a 4xx answer an error', async () => {
    const notFound = await run(fakeRequest('/missing'), [answer(404)]);

    expect(firstRequest(notFound)).toMatchObject({ status: 404, ok: true });

    const unauthorized = await run(fakeRequest('/private'), [answer(401)]);

    expect(firstRequest(unauthorized)).toMatchObject({ status: 401, ok: true });
  });

  it('marks a 5xx answer as not ok', async () => {
    const events = await run(fakeRequest('/broken'), [answer(503)]);

    expect(firstRequest(events)).toMatchObject({ status: 503, ok: false });
  });

  it('reports the operation a stage recorded', async () => {
    const stage: Stage = ctx => {
      ctx.operation = 'initialize';
      ctx.res.end();

      return true;
    };
    const events = await run(fakeRequest('/', 'POST'), [stage]);

    expect(firstRequest(events).operation).toBe('initialize');
  });

  it('logs a request whose stage threw, with the error message', async () => {
    const stage: Stage = () => {
      throw new Error('render blew up');
    };
    const events = await run(fakeRequest('/boom'), [stage]);

    expect(firstRequest(events)).toMatchObject({ path: '/boom', ok: false, error: 'render blew up' });
  });

  it('logs a request no stage answered', async () => {
    const events = await run(fakeRequest('/nothing'), [() => false]);

    expect(events).toHaveLength(1);
    expect(firstRequest(events).path).toBe('/nothing');
  });
});

describe('dispatcher client IP', () => {
  it('trusts the edge over the headers behind it', async () => {
    const raw = fakeClientRequest(
      { 'cf-connecting-ip': '203.0.113.7', 'x-real-ip': '10.0.0.5', 'x-forwarded-for': '10.0.0.9' },
      '10.42.0.1'
    );
    const events = await run(raw, [answer(200)]);

    expect(firstRequest(events).clientIp).toBe('203.0.113.7');
  });

  it('takes the original client from the head of the x-forwarded-for chain', async () => {
    const raw = fakeClientRequest({ 'x-forwarded-for': '203.0.113.7, 70.41.3.18, 150.172.238.178' }, '10.42.0.1');
    const events = await run(raw, [answer(200)]);

    expect(firstRequest(events).clientIp).toBe('203.0.113.7');
  });

  it('falls back to the socket peer, in its plain IPv4 form', async () => {
    const events = await run(fakeClientRequest({}, '::ffff:203.0.113.7'), [answer(200)]);

    expect(firstRequest(events).clientIp).toBe('203.0.113.7');
  });

  it('keeps an IPv6 peer intact', async () => {
    const events = await run(fakeClientRequest({}, '2001:db8::1'), [answer(200)]);

    expect(firstRequest(events).clientIp).toBe('2001:db8::1');
  });

  it('omits the field when nothing identifies the peer', async () => {
    const events = await run(fakeClientRequest({}), [answer(200)]);

    expect(firstRequest(events).clientIp).toBeUndefined();
  });

  it('reports the client of a request whose stage threw', async () => {
    const stage: Stage = () => {
      throw new Error('render blew up');
    };
    const events = await run(fakeClientRequest({ 'cf-connecting-ip': '203.0.113.7' }), [stage]);

    expect(firstRequest(events).clientIp).toBe('203.0.113.7');
  });
});
