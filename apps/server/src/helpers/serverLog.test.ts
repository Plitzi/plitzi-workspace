import { afterEach, describe, expect, it, vi } from 'vitest';

import { configureServerLog, defaultLogLevel, isLogged, logLevelOf, renderLogEvent, serverLog } from './serverLog';

import type { ServerLogEvent, ServerLogger } from '@plitzi/sdk-shared';

const request = (ok: boolean): ServerLogEvent => ({
  kind: 'request',
  server: 'SSR',
  method: 'GET',
  path: '/',
  status: ok ? 200 : 500,
  durationMs: 3,
  ok,
  timestamp: '2026-09-24T00:00:00.000Z'
});

afterEach(() => {
  configureServerLog({ level: 'info' });
});

describe('serverLog — levels', () => {
  it('orders the levels the usual way: a threshold lets through itself and everything more severe', () => {
    expect(isLogged('error', 'error')).toBe(true);
    expect(isLogged('error', 'warn')).toBe(false);
    expect(isLogged('warn', 'error')).toBe(true);
    expect(isLogged('info', 'debug')).toBe(false);
    expect(isLogged('debug', 'debug')).toBe(true);
    expect(isLogged('silent', 'error')).toBe(false);
  });

  it('says only what went wrong in production, and more while developing', () => {
    expect(defaultLogLevel()).toBe('error');
    expect(defaultLogLevel(true)).toBe('info');
  });

  it('reads a request as an error when it failed and as info when it did not', () => {
    expect(logLevelOf(request(false))).toBe('error');
    expect(logLevelOf(request(true))).toBe('info');
  });

  it('calls a refused action a warning: the caller was turned away, the server did not fail', () => {
    const refused: ServerLogEvent = {
      kind: 'reject',
      name: 'checkout',
      spaceId: 1,
      environment: 'production',
      trigger: 'webhook',
      reason: 'invalid_signature',
      durationMs: 0,
      ok: false,
      timestamp: '2026-09-24T00:00:00.000Z'
    };

    expect(logLevelOf(refused)).toBe('warn');
  });

  it('holds a sink the consumer wired itself to the same threshold', () => {
    const sink = vi.fn<ServerLogger>();
    configureServerLog({ level: 'error' });

    serverLog.emit(sink, request(true));
    serverLog.emit(sink, request(false));

    expect(sink).toHaveBeenCalledTimes(1);
  });

  it('drops what is below the threshold without building the event', () => {
    const sink = vi.fn<ServerLogger>();
    configureServerLog({ level: 'error', logger: sink });

    serverLog.info('SSR', 'listening');
    serverLog.warn('SSR', 'manifest missing');
    serverLog.error('RSC', 'element failed to resolve', new Error('boom'));

    expect(sink).toHaveBeenCalledTimes(1);
    expect(sink.mock.calls[0][0]).toMatchObject({ kind: 'message', level: 'error', scope: 'RSC', ok: false });
    expect(serverLog.enabled('debug')).toBe(false);
  });

  it('says nothing at all when silent', () => {
    const sink = vi.fn<ServerLogger>();
    configureServerLog({ level: 'silent', logger: sink });

    serverLog.error('RSC', 'element failed to resolve');

    expect(sink).not.toHaveBeenCalled();
  });
});

describe('serverLog — rendering', () => {
  it('reads a message as its scope, what happened and why', () => {
    const sink = vi.fn<ServerLogger>();
    configureServerLog({ level: 'debug', logger: sink });

    serverLog.warn('SSR', 'Failed to fetch plugin manifest', 'HTTP 404');
    serverLog.debug('SSR', 'page — render=4ms | total=5ms');

    expect(renderLogEvent(sink.mock.calls[0][0])).toBe('[SSR] Failed to fetch plugin manifest: HTTP 404');
    expect(renderLogEvent(sink.mock.calls[1][0])).toBe('[SSR] page — render=4ms | total=5ms');
  });
});
