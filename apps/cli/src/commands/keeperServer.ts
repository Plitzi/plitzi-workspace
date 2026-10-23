import http from 'node:http';

/**
 * The kept browser's door: asks over HTTP on 127.0.0.1 alone, each to its route — a reading of the other page, its
 * outline, a step of a page held for a play — and each answered with what it did. An ask is in flight from its arrival
 * — its body still on its way — so a drain that comes meanwhile waits for it; a drain first stops taking asks, then
 * waits for those it took. An ask past `askMs` is answered as too slow, for its caller to do it as before.
 */

/** What a route answers: a body as JSON, and its status — 400 for an ask it cannot read. */
export interface RouteAnswer {
  status: number;
  body: unknown;
}

/** A route: the ask's body as JSON, unread — each route says what it takes. */
export type Route = (asked: unknown) => Promise<RouteAnswer>;

export interface KeeperServerOptions {
  /** Each path it answers, `/measure` and the rest. */
  routes: Readonly<Record<string, Route>>;
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

/** What an ask it could not do is answered with: why, for its caller to do it as before. */
export const problem = (why: string): { problem: string } => ({ problem: why });

export const keeperServer = ({ routes, askMs, bodyBytes, onError }: KeeperServerOptions): KeeperServer => {
  let inFlight = 0;
  let lastUse = Date.now();
  let draining = false;

  const server = http.createServer((request, response) => {
    const answer = (status: number, body: unknown): void => {
      if (!response.headersSent) {
        response.writeHead(status, { 'content-type': 'application/json' });
        response.end(JSON.stringify(body));
      }
    };
    const route = request.method === 'POST' && request.url !== undefined ? routes[request.url] : undefined;
    if (!route || draining) {
      answer(404, problem('not a kept browser’s ask'));

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
        answer(413, problem('an ask too large'));
        request.destroy();
      }
    });
    request.on('end', () => {
      let asked: unknown;
      try {
        asked = JSON.parse(text);
      } catch {
        answer(400, problem('an ask that is no JSON'));

        return;
      }

      let timer: NodeJS.Timeout | undefined;
      const slow = new Promise<RouteAnswer>(resolve => {
        timer = setTimeout(() => resolve({ status: 200, body: problem('the kept browser took too long') }), askMs);
      });
      void Promise.race([route(asked), slow])
        .then(
          answered => answer(answered.status, answered.body),
          (error: unknown) => {
            answer(200, problem(error instanceof Error ? (error.message.split('\n')[0] ?? 'failed') : 'failed'));
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
