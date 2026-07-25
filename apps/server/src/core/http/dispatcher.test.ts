import { describe, expect, it } from 'vitest';

import { makeHandler } from './dispatcher';

import type { BuildContext } from './dispatcher';
import type { BaseContext, Stage } from './types';
import type { RawResponse } from '../../helpers/buildResponseHelpers';
import type { ServerLogEvent, ServerRequestLogEvent, SSRServerConfig } from '@plitzi/sdk-shared';
import type { IncomingMessage } from 'node:http';

const fakeRequest = (url: string, method = 'GET'): IncomingMessage =>
  ({ url, method, headers: { host: 'example.test' }, socket: {} }) as unknown as IncomingMessage;

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

  it('marks a 4xx answer as not ok', async () => {
    const events = await run(fakeRequest('/missing'), [answer(404)]);

    expect(firstRequest(events)).toMatchObject({ status: 404, ok: false });
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
