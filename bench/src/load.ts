import http from 'node:http';
import { setTimeout as sleep } from 'node:timers/promises';

export type Scenario = {
  name: string;
  method: 'GET' | 'POST';
  path: string;
  headers?: Record<string, string>;
  body?: string;
  /** Statuses that count as an answer. Anything else is reported as unexpected, never silently averaged in. */
  expectStatus?: number[];
};

export type LoadOptions = {
  baseUrl: string;
  scenario: Scenario;
  concurrency: number;
  durationMs: number;
  /** A request still unanswered after this long is abandoned and counted as an error. */
  timeoutMs?: number;
  /**
   * Connections to reuse, from a warm-up at the same concurrency. Without them the measurement opens every
   * connection at once against a server already saturated, and the first request on each waits to be accepted.
   */
  agent?: http.Agent;
};

export type LoadResult = {
  requests: number;
  /** Requests that got no HTTP answer at all: refused, reset, timed out. */
  errors: number;
  /** Answered with a status the scenario does not expect, by status. */
  unexpected: Record<number, number>;
  bytes: number;
  latenciesMs: number[];
  elapsedMs: number;
};

// What a browser sends, so the server compresses the way it would for a visitor.
const DEFAULT_HEADERS = { 'accept-encoding': 'br, gzip' };

// A server that is down refuses instantly; retrying at once would spin the load generator instead of waiting for it.
const ERROR_BACKOFF_MS = 50;

type Answer = { status: number; bytes: number };

const request = (agent: http.Agent, url: URL, scenario: Scenario, timeoutMs: number): Promise<Answer> =>
  new Promise((resolve, reject) => {
    const req = http.request(
      url,
      { method: scenario.method, agent, headers: { ...DEFAULT_HEADERS, ...scenario.headers }, timeout: timeoutMs },
      res => {
        let bytes = 0;
        res.on('data', (chunk: Buffer) => {
          bytes += chunk.length;
        });
        res.on('end', () => {
          resolve({ status: res.statusCode ?? 0, bytes });
        });
        res.on('error', reject);
      }
    );
    req.on('timeout', () => {
      req.destroy(new Error(`no answer within ${timeoutMs}ms`));
    });
    req.on('error', reject);
    req.end(scenario.body);
  });

/** Keep-alive connections for one concurrency level, shared by its warm-up and its measurement. */
export const createLoadAgent = (concurrency: number): http.Agent =>
  new http.Agent({ keepAlive: true, maxSockets: concurrency });

/**
 * Closed-loop load: `concurrency` connections, each sending its next request as soon as the last one answered.
 *
 * Closed loop measures what the server sustains, not what it does under an arrival rate it cannot keep up with — a
 * slow server slows the generator down with it, so latency here is service time under that many clients in flight.
 */
export const runLoad = async (options: LoadOptions): Promise<LoadResult> => {
  const { baseUrl, scenario, concurrency, durationMs, timeoutMs = 30_000 } = options;
  const url = new URL(scenario.path, baseUrl);
  const expected = new Set(scenario.expectStatus ?? [200]);
  const agent = options.agent ?? createLoadAgent(concurrency);
  const result: LoadResult = { requests: 0, errors: 0, unexpected: {}, bytes: 0, latenciesMs: [], elapsedMs: 0 };
  const startedAt = performance.now();
  const deadline = startedAt + durationMs;

  const client = async (): Promise<void> => {
    while (performance.now() < deadline) {
      const sentAt = performance.now();
      try {
        const answer = await request(agent, url, scenario, timeoutMs);
        result.requests += 1;
        result.bytes += answer.bytes;
        result.latenciesMs.push(performance.now() - sentAt);
        if (!expected.has(answer.status)) {
          result.unexpected[answer.status] = (result.unexpected[answer.status] ?? 0) + 1;
        }
      } catch {
        result.errors += 1;
        await sleep(ERROR_BACKOFF_MS);
      }
    }
  };

  await Promise.all(Array.from({ length: concurrency }, client));
  result.elapsedMs = performance.now() - startedAt;
  if (!options.agent) {
    agent.destroy();
  }

  return result;
};

/**
 * Waits until `path` answers 2xx or 3xx, and says how long that took. Throws once `timeoutMs` has gone by, or as soon
 * as `alive` says the server is gone — a server that crashed while starting must not be waited on for minutes.
 */
export const waitUntilReady = async (
  baseUrl: string,
  path: string,
  timeoutMs: number,
  alive: () => Promise<boolean>
): Promise<number> => {
  const startedAt = performance.now();
  const agent = new http.Agent({ keepAlive: false });
  const probe: Scenario = { name: 'ready', method: 'GET', path };

  try {
    while (performance.now() - startedAt < timeoutMs) {
      try {
        const { status } = await request(agent, new URL(path, baseUrl), probe, 5_000);
        if (status >= 200 && status < 400) {
          return performance.now() - startedAt;
        }
      } catch {
        if (!(await alive())) {
          throw new Error(`the server stopped before ${path} answered`);
        }
      }

      await sleep(100);
    }
  } finally {
    agent.destroy();
  }

  throw new Error(`${baseUrl}${path} did not answer within ${timeoutMs}ms`);
};
