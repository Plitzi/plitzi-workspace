import http from 'node:http';
import http2 from 'node:http2';
import https from 'node:https';

import type { RawResponse } from '../helpers/buildResponseHelpers';
import type { SSRServerConfig } from '@plitzi/sdk-shared';
import type { IncomingMessage, RequestListener } from 'node:http';

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
    return hasTls ? 'HTTP/2 (TLS)' : 'HTTP/1.1';
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
        // @ts-expect-error eslint-disable-line
        const mod = (await import('node:http3')) as unknown as H3Module;
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
      // Browsers don't support h2c; fall back to HTTP/1.1 for dev without TLS
      primary = http.createServer(handler as RequestListener);
    }
  } else if (config.tls) {
    primary = https.createServer(tlsOptions(config), handler as RequestListener);
  } else {
    primary = http.createServer(handler as RequestListener);
  }

  return { primary, h3 };
};
