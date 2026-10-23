import http from 'node:http';

import type { KeptAnswer, KeptAsk } from '../browser/keptBrowser';

/**
 * The kept browser's door: asks to measure, over HTTP on 127.0.0.1 alone, each answered with what was read. An ask is
 * in flight from its arrival — its body still on its way — so a drain that comes meanwhile waits for it; a drain first
 * stops taking asks, then waits for those it took. An ask past `askMs` is answered as too slow, for its caller to read
 * the page as before.
 */

export interface KeeperServerOptions {
  measure: (asked: KeptAsk) => Promise<KeptAnswer>;
  /** The longest one ask is worked on before it is answered as too slow. */
  askMs: number;
  /** The largest ask it reads: a list of elements, never more. */
  bodyBytes: number;
  /** What failed under an ask, for the process to stop where its browser is gone. */
  onError?: (error: unknown) => void;
}

export interface KeeperServer {
  /** Listens on a port of its own choosing on 127.0.0.1: where it answers. */
  listen: () => Promise<number>;
  /** Takes no ask from now on, and waits for those taken — `ms` at most. Whether it ended with none left. */
  drain: (ms: number) => Promise<boolean>;
  inFlight: () => number;
  /** When it was last asked, or last answered. */
  lastUse: () => number;
}

const isAsk = (value: unknown): value is KeptAsk => {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  const targets: unknown = Reflect.get(value, 'targets');

  return (
    typeof Reflect.get(value, 'url') === 'string' &&
    typeof Reflect.get(value, 'width') === 'number' &&
    typeof Reflect.get(value, 'height') === 'number' &&
    Array.isArray(targets) &&
    targets.every(target => typeof target === 'string')
  );
};

export const keeperServer = ({ measure, askMs, bodyBytes, onError }: KeeperServerOptions): KeeperServer => {
  let inFlight = 0;
  let lastUse = Date.now();
  let draining = false;

  const server = http.createServer((request, response) => {
    const answer = (status: number, body: KeptAnswer): void => {
      if (!response.headersSent) {
        response.writeHead(status, { 'content-type': 'application/json' });
        response.end(JSON.stringify(body));
      }
    };
    if (request.method !== 'POST' || request.url !== '/measure' || draining) {
      answer(404, { problem: 'not a kept browser’s ask' });

      return;
    }

    inFlight += 1;
    lastUse = Date.now();
    let counted = true;
    const done = (): void => {
      if (counted) {
        counted = false;
        inFlight -= 1;
        lastUse = Date.now();
      }
    };
    response.on('close', done);
    let text = '';
    request.setEncoding('utf8');
    request.on('data', (chunk: string) => {
      text += chunk;
      if (text.length > bodyBytes) {
        answer(413, { problem: 'an ask too large' });
        request.destroy();
      }
    });
    request.on('end', () => {
      let asked: unknown;
      try {
        asked = JSON.parse(text);
      } catch {
        answer(400, { problem: 'an ask that is no JSON' });

        return;
      }

      if (!isAsk(asked)) {
        answer(400, { problem: 'an ask without its page and elements' });

        return;
      }

      let timer: NodeJS.Timeout | undefined;
      const slow = new Promise<KeptAnswer>(resolve => {
        timer = setTimeout(() => resolve({ problem: 'the kept browser took too long' }), askMs);
      });
      void Promise.race([measure(asked), slow])
        .then(
          body => answer(200, body),
          (error: unknown) => {
            answer(200, { problem: error instanceof Error ? (error.message.split('\n')[0] ?? 'failed') : 'failed' });
            onError?.(error);
          }
        )
        .finally(() => {
          clearTimeout(timer);
          done();
        });
    });
  });

  return {
    listen: () =>
      new Promise((resolve, reject) => {
        server.once('error', reject);
        server.listen(0, '127.0.0.1', () => {
          const address = server.address();
          if (address !== null && typeof address === 'object') {
            resolve(address.port);
          } else {
            reject(new Error('no port'));
          }
        });
      }),
    drain: async ms => {
      draining = true;
      server.close();
      const until = Date.now() + ms;
      while (inFlight > 0 && Date.now() < until) {
        await new Promise(resolve => setTimeout(resolve, 50));
      }

      return inFlight === 0;
    },
    inFlight: () => inFlight,
    lastUse: () => lastUse
  };
};
