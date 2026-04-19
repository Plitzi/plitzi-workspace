import http from 'node:http';
import http2 from 'node:http2';
import https from 'node:https';

import type { RawResponse } from '../helpers/buildResponseHelpers';
import type { SSRServerConfig } from '../types';
import type { IncomingMessage } from 'node:http';

export type CloseableServer = {
  close: (cb?: (err?: Error) => void) => unknown;
  listen: (port: number, host: string, cb: () => void) => unknown;
};

export type Handler = (req: IncomingMessage, res: RawResponse) => void;

type H3Module = { createServer: (opts: object, handler: Handler) => CloseableServer };

export const tlsOptions = (config: SSRServerConfig) => {
  const { tls } = config;
  if (!tls) {
    throw new Error('[SSR] TLS config required');
  }
  return { key: tls.key, cert: tls.cert, minVersion: (tls.minVersion ?? 'TLSv1.3') as 'TLSv1.3' };
};

export const protoLabel = (version: number, hasTls: boolean): string => {
  if (version >= 3) {
    return 'HTTP/2+3 (TLS)';
  }
  if (version >= 2) {
    return hasTls ? 'HTTP/2 (TLS)' : 'HTTP/2 (h2c)';
  }
  return hasTls ? 'HTTPS/1.1' : 'HTTP/1.1';
};

export const buildTransport = (
  config: SSRServerConfig,
  handler: Handler,
  port: number
): { primary: CloseableServer; h3?: CloseableServer } => {
  const version = config.httpVersion ?? 2;
  let primary: CloseableServer;
  let h3: CloseableServer | undefined;

  if (version >= 3) {
    primary = http2.createSecureServer(
      { ...tlsOptions(config), allowHTTP1: true },
      handler as unknown as Parameters<typeof http2.createSecureServer>[1]
    );

    void (async () => {
      try {
        const mod = (await import('node:http3' as string)) as unknown as H3Module;
        h3 = mod.createServer(tlsOptions(config), handler);
        h3.listen(port, '0.0.0.0', () => {
          console.log(`[SSR] HTTP/3 (QUIC) listening on port ${port}`);
        });
      } catch {
        console.warn(
          '[SSR] HTTP/3 unavailable — start Node.js with --experimental-quic (requires Node ≥ 23). Falling back to HTTP/2.'
        );
      }
    })();
  } else if (version >= 2) {
    if (config.tls) {
      primary = http2.createSecureServer(
        { ...tlsOptions(config), allowHTTP1: true },
        handler as unknown as Parameters<typeof http2.createSecureServer>[1]
      );
    } else {
      primary = http2.createServer({}, handler as unknown as Parameters<typeof http2.createServer>[1]);
    }
  } else if (config.tls) {
    primary = https.createServer(tlsOptions(config), handler as Parameters<typeof https.createServer>[1]);
  } else {
    primary = http.createServer(handler as Parameters<typeof http.createServer>[0]);
  }

  return { primary, h3 };
};
