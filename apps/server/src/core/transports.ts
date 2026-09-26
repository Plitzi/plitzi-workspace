import http from 'node:http';
import http2 from 'node:http2';
import https from 'node:https';

import { serverLog } from '../helpers/serverLog';

import type { RawResponse } from '../helpers/buildResponseHelpers';
import type { SSRServerConfig } from '@plitzi/sdk-shared';
import type { IncomingMessage, RequestListener } from 'node:http';
import type { Duplex } from 'node:stream';

export type CloseableServer = {
  close: (cb?: (err?: Error) => void) => unknown;
  listen: (port: number, host: string, cb: () => void) => unknown;
  /** Bind failures arrive here. Without a listener Node throws the `error` event as an uncaught exception, which
   *  is how a taken port used to read as a crash in `node:net` rather than as this server not starting. */
  on: (event: 'error', listener: (error: NodeJS.ErrnoException) => void) => unknown;
};

/** A request asking to switch protocols: node hands over the socket, and the bytes it read past the headers. */
export type UpgradeHandler = (req: IncomingMessage, socket: Duplex, head: Buffer) => void;

/** What a server answers requests with — and, when it takes any, upgrades (`upgrade`). */
export type Handler = ((req: IncomingMessage, res: RawResponse) => void) & { upgrade?: UpgradeHandler };

type H3Module = { createServer: (opts: object, handler: Handler) => CloseableServer };

export const tlsOptions = (config: SSRServerConfig, label = 'Server') => {
  const { tls } = config;
  if (!tls) {
    throw new Error(`[${label}] TLS config required`);
  }
  return { key: tls.key, cert: tls.cert, minVersion: (tls.minVersion ?? 'TLSv1.3') as 'TLSv1.3' };
};

export const protoLabel = (version: number, hasTls: boolean): string => {
  if (version >= 3) {
    return 'HTTP/2+3 (TLS)';
  }

  if (version >= 2) {
    return hasTls ? 'HTTP/2 (TLS)' : 'HTTP/1.1 - TLS Missing';
  }

  return hasTls ? 'HTTPS/1.1' : 'HTTP/1.1';
};

/**
 * Upgrades reach HTTP/1.1 servers only. Over HTTP/2 a browser has no way to ask for one — node does not speak the
 * extended CONNECT that WebSockets over h2 need — so a client there stays on what plain requests can do.
 */
const withUpgrades = <S extends http.Server | https.Server>(server: S, handler: Handler): S => {
  if (handler.upgrade) {
    server.on('upgrade', handler.upgrade);
  }

  return server;
};

export const buildTransport = (
  config: SSRServerConfig,
  handler: Handler,
  port: number,
  label = 'Server'
): { primary: CloseableServer; h3?: CloseableServer } => {
  const version = config.httpVersion ?? 2;
  let primary: CloseableServer;
  let h3: CloseableServer | undefined;

  if (version >= 3) {
    primary = http2.createSecureServer(
      { ...tlsOptions(config, label), allowHTTP1: true },
      handler as unknown as Parameters<typeof http2.createSecureServer>[1]
    );

    void (async () => {
      try {
        // @ts-expect-error eslint-disable-line
        const mod = (await import('node:http3')) as unknown as H3Module;
        h3 = mod.createServer(tlsOptions(config, label), handler);
        h3.listen(port, '0.0.0.0', () => {
          serverLog.info(label, `HTTP/3 (QUIC) listening on port ${port}`);
        });
      } catch {
        serverLog.warn(
          label,
          'HTTP/3 unavailable — start Node.js with --experimental-quic (requires Node ≥ 23). Falling back to HTTP/2.'
        );
      }
    })();
  } else if (version >= 2) {
    if (config.tls) {
      primary = http2.createSecureServer(
        { ...tlsOptions(config, label), allowHTTP1: true },
        handler as unknown as Parameters<typeof http2.createSecureServer>[1]
      );
    } else {
      // Browsers don't support h2c; fall back to HTTP/1.1 for dev without TLS
      primary = withUpgrades(http.createServer(handler as RequestListener), handler);
    }
  } else if (config.tls) {
    primary = withUpgrades(https.createServer(tlsOptions(config, label), handler as RequestListener), handler);
  } else {
    primary = withUpgrades(http.createServer(handler as RequestListener), handler);
  }

  return { primary, h3 };
};
