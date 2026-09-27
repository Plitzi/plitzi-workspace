import { randomUUID } from 'node:crypto';

import { WebStandardStreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js';

import { createAgentServer } from './server.ts';
import { parseLink } from './session.ts';
import { colourOfName } from '../board/people.ts';

import type { AgentServer } from './server.ts';
import type { Door } from './session.ts';
import type { AgentDirectory } from '../deployment.ts';
import type { BaseContext, Stage } from '@plitzi/sdk-server';

/**
 * Pizarra's agent, served by Pizarra: `/mcp`, over streamable HTTP — what the invite panel tells anyone on a board to
 * add to their agent, with nothing else to install or run. `claude mcp add --scope user --transport http pizarra <origin>/mcp`,
 * `opencode mcp add pizarra --url <origin>/mcp`, a custom connector in the Claude app.
 *
 * An agent is not stateless: it is on a board, with a socket on the board's channels and what it has heard since. So
 * each is a session (`Mcp-Session-Id`) held by the replica its client reached first, which calls the board's actions
 * and opens its channels on itself — the boards and the channels are the cluster's, so any replica serves any board.
 * The replica says it holds the session (`AgentDirectory`), and a request for it that another replica takes — behind a
 * balancer with no affinity, that is most of them — is passed on to it, and the answer passed back.
 *
 * An agent connected here joins this Pizarra's boards. A link to a board on another one is refused with the address
 * of that one's agent: a server calling out to any address an agent is handed is not something to offer the Internet.
 */

export const AGENT_PATH = '/mcp';

/** The header a replica passes a session on with: the one it reaches answers it, or says it is gone — never passes it on. */
const FORWARDED = 'x-pizarra-forwarded';

/**
 * How long a session nobody has asked anything is kept. One on a board stays for as long as the board wants it (the
 * board decides: nobody there, its quiet time, being asked to go) — this is only the bound past which a client that
 * never came back is let go for good. One on no board is only a connection, and goes much sooner.
 */
const SESSION_IDLE_MS = { onBoard: 12 * 60 * 60 * 1000, offBoard: 30 * 60 * 1000 };

/** How many agents one replica holds at once: each is a socket on a board and a board's worth of memory. */
const MAX_AGENTS = 200;

/** What a request says at most: tool calls are small; a board's worth of elements is the largest. */
const MAX_BODY_BYTES = 4 * 1024 * 1024;

/**
 * How long after its app stops listening an agent is taken to be gone. An app like Claude Code keeps a stream open to
 * hear the server (the MCP `GET`) for as long as it runs: closed and not opened again — the app quit, crashed, lost its
 * network for good — the agent leaves its board instead of standing there answering nobody.
 */
const CLIENT_GONE_MS = 60_000;

type Held = {
  transport: WebStandardStreamableHTTPServerTransport;
  agent: AgentServer;
  lastSeen: number;
  /** Its app's streams open now — and whether it ever opened one, which is what makes one closing mean anything. */
  streams: number;
  listened: boolean;
  gone?: ReturnType<typeof setTimeout>;
};

/** What the people on a board see an agent as, from the app it came through, until it names itself. */
const CLIENT_NAMES: readonly [RegExp, string][] = [
  [/claude[-\s]?code/i, 'Claude Code'],
  [/claude/i, 'Claude'],
  [/opencode/i, 'OpenCode'],
  [/cursor/i, 'Cursor'],
  [/codex/i, 'Codex'],
  [/gemini/i, 'Gemini'],
  [/copilot|vscode|visual studio/i, 'Copilot']
];

export const agentNameOf = (client: string | undefined): string =>
  CLIENT_NAMES.find(([pattern]) => client !== undefined && pattern.test(client))?.[1] ?? 'Agent';

const firstOf = (value: string | string[] | undefined): string | undefined =>
  (Array.isArray(value) ? value[0] : value)?.split(',')[0]?.trim() || undefined;

const jsonRpcError = (status: number, message: string): Response =>
  Response.json({ jsonrpc: '2.0', error: { code: -32000, message }, id: null }, { status });

/** A request's body, whole: small enough to hold, and read once whether it is answered here or passed on. */
const readBody = (ctx: BaseContext): Promise<Buffer | undefined> =>
  new Promise((resolve, reject) => {
    const { raw } = ctx;
    if (raw.method === 'GET' || raw.method === 'HEAD' || raw.method === 'DELETE' || raw.method === 'OPTIONS') {
      resolve(undefined);

      return;
    }

    const chunks: Buffer[] = [];
    let size = 0;
    raw.on('data', (chunk: Buffer) => {
      size += chunk.length;
      if (size > MAX_BODY_BYTES) {
        reject(new Error('too large'));
        raw.destroy();

        return;
      }

      chunks.push(chunk);
    });
    raw.on('end', () => resolve(Buffer.concat(chunks)));
    raw.on('error', reject);
  });

const headersOf = (ctx: BaseContext): Headers => {
  const headers = new Headers();
  for (const [name, value] of Object.entries(ctx.raw.headers)) {
    for (const one of Array.isArray(value) ? value : value === undefined ? [] : [value]) {
      headers.append(name, one);
    }
  }

  return headers;
};

/** What to do once an answer has gone out — or its client has stopped taking it: a stream that ends. */
const ended = new WeakMap<Response, () => void>();

/** The answer, onto the wire: its status, its headers, and its body as it comes — an event stream stays open. */
const send = async (ctx: BaseContext, response: Response): Promise<void> => {
  const { rawRes, signal } = ctx;
  const headers: Record<string, string> = {
    'access-control-allow-origin': '*',
    'access-control-expose-headers': 'Mcp-Session-Id'
  };
  response.headers.forEach((value, name) => {
    headers[name] = value;
  });
  rawRes.writeHead(response.status, headers);
  if (!response.body) {
    rawRes.end();

    return;
  }

  const reader = response.body.getReader();
  const stop = (): void => {
    void reader.cancel();
  };
  signal.addEventListener('abort', stop, { once: true });
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) {
        break;
      }

      rawRes.write(Buffer.from(value));
    }
  } catch {
    // The client left mid-answer: nothing is waiting for the rest.
  } finally {
    signal.removeEventListener('abort', stop);
    rawRes.end();
  }
};

/** Where this replica calls itself: its own port, on loopback unless it listens on one address only. */
const insideOrigin = (host: string, port: number): string =>
  `http://${host === '0.0.0.0' || host === '::' || host === 'localhost' ? '127.0.0.1' : host}:${port}`;

/**
 * This Pizarra's address as the agent's client reached it — what links on it look like. `PIZARRA_PUBLIC_URL` when a
 * proxy in front says nothing of it.
 */
const publicOriginOf = (ctx: BaseContext, configured: string | undefined): string => {
  if (configured) {
    return configured.replace(/\/+$/, '');
  }

  const proto = firstOf(ctx.req.headers['x-forwarded-proto']) ?? ctx.req.protocol;
  const host = firstOf(ctx.req.headers['x-forwarded-host']) ?? firstOf(ctx.req.headers.host) ?? ctx.req.hostname;

  return `${proto}://${host}`;
};

const WHAT_THIS_IS =
  'This is Pizarra’s endpoint for AI agents (MCP, streamable HTTP). Add this address to your agent — ' +
  '`claude mcp add --scope user --transport http pizarra <this address>`, `opencode mcp add pizarra --url <this address>`, ' +
  'or a custom connector in the Claude app — then send it a board’s link.';

export type AgentEndpoint = {
  stage: Stage<BaseContext>;
  /** Every agent off its board: the server is going away. */
  close: () => Promise<void>;
};

export const createAgentEndpoint = ({
  directory,
  host,
  port,
  publicUrl
}: {
  directory: AgentDirectory;
  /** Where this server listens, so a hosted agent calls it from inside. */
  host: string;
  port: number;
  /** This Pizarra's public address, when a proxy in front of it does not say. */
  publicUrl?: string;
}): AgentEndpoint => {
  const held = new Map<string, Held>();
  const inside = insideOrigin(host, port);

  const drop = async (session: string, reason: string): Promise<void> => {
    const entry = held.get(session);
    held.delete(session);
    clearTimeout(entry?.gone);
    entry?.agent.leave(reason);
    await Promise.all([entry?.transport.close(), directory.release(session)]);
  };

  // Agents nobody has spoken to for a while leave their boards — and this replica's memory.
  const sweep = setInterval(() => {
    const now = Date.now();
    for (const [session, entry] of held) {
      if (now - entry.lastSeen > SESSION_IDLE_MS[entry.agent.present() ? 'onBoard' : 'offBoard']) {
        void drop(session, 'my app has not been back for hours');
      }
    }
  }, 60_000);
  sweep.unref();

  /**
   * Its app not listening, for now: gone unless it listens — or asks anything — again within {@link CLIENT_GONE_MS}.
   * Only for an app that listens at all; one that never opens a stream is left to the board's own rules.
   */
  const unheard = (session: string, entry: Held): void => {
    clearTimeout(entry.gone);
    if (entry.listened && entry.streams === 0) {
      entry.gone = setTimeout(() => void drop(session, 'my app disconnected'), CLIENT_GONE_MS);
      entry.gone.unref();
    }
  };

  /** Its app listening: the stream is counted while it is open, and its end starts the wait for the app to be back. */
  const listening = (session: string, entry: Held, response: Response): Response => {
    entry.streams += 1;
    entry.listened = true;
    clearTimeout(entry.gone);
    ended.set(response, () => {
      entry.streams -= 1;
      unheard(session, entry);
    });

    return response;
  };

  /** A new agent: its server, and the transport that makes it a session once its client says `initialize`. */
  const open = (ctx: BaseContext): Held => {
    const publicOrigin = publicOriginOf(ctx, publicUrl);
    // Who is asking, for what the board counts against a caller: the agent's client, not this replica's loopback.
    const door: Door = {
      origin: inside,
      publicOrigin,
      ...(ctx.req.ip ? { headers: { 'x-forwarded-for': ctx.req.ip } } : {})
    };
    const agent = createAgentServer({
      home: door,
      locate: link => {
        const { origin, board, key } = parseLink(link, publicOrigin);

        return {
          door,
          board,
          ...(key ? { key } : {}),
          ...(new URL(origin).host === new URL(publicOrigin).host ? {} : { elsewhere: origin })
        };
      },
      identity: () => {
        const name = agentNameOf(agent.server.server.getClientVersion()?.name);

        return { name, color: colourOfName(name) };
      }
    });
    const entry: Held = {
      agent,
      lastSeen: Date.now(),
      streams: 0,
      listened: false,
      transport: new WebStandardStreamableHTTPServerTransport({
        sessionIdGenerator: randomUUID,
        // Answers as event streams: a long wait for the people is kept open by the stream's keep-alives, where a
        // silent JSON answer is cut by the first proxy with a read timeout.
        onsessioninitialized: session => {
          held.set(session, entry);
          void directory.hold(session);
        },
        onsessionclosed: session => {
          void drop(session, 'my app closed the connection');
        }
      })
    };

    return entry;
  };

  /** A session another replica holds: passed on to it, and its answer passed back — or, when it is gone, said so. */
  const passOn = async (ctx: BaseContext, session: string, body: Buffer | undefined): Promise<Response> => {
    const owner = ctx.req.headers[FORWARDED] ? undefined : await directory.ownerOf(session);
    if (!owner || owner === directory.self) {
      // Gone with a replica that stopped, or forgotten after a long quiet: the client starts a new session.
      return jsonRpcError(404, 'Session not found — connect again');
    }

    const headers = headersOf(ctx);
    for (const name of ['host', 'connection', 'content-length', 'transfer-encoding']) {
      headers.delete(name);
    }

    headers.set(FORWARDED, '1');
    if (ctx.req.ip && !headers.has('x-forwarded-for')) {
      headers.set('x-forwarded-for', ctx.req.ip);
    }

    try {
      return await fetch(new URL(ctx.raw.url ?? AGENT_PATH, owner), {
        method: ctx.raw.method ?? 'POST',
        headers,
        ...(body ? { body: new Uint8Array(body) } : {}),
        signal: ctx.signal
      });
    } catch {
      // Its own client leaving is not the owner failing: the session is still there, for when it comes back.
      if (ctx.signal.aborted) {
        return new Response(null, { status: 499 });
      }

      await directory.release(session);

      return jsonRpcError(404, 'Session not found — connect again');
    }
  };

  const answer = async (ctx: BaseContext): Promise<Response> => {
    const { raw } = ctx;
    if (raw.method === 'OPTIONS') {
      return new Response(null, {
        status: 204,
        headers: {
          'access-control-allow-methods': 'GET, POST, DELETE, OPTIONS',
          'access-control-allow-headers': '*',
          'access-control-max-age': '86400'
        }
      });
    }

    const session = firstOf(ctx.req.headers['mcp-session-id']);
    // Somebody opened the address in a browser: what it is, and what to do with it.
    if (raw.method === 'GET' && !session && !firstOf(ctx.req.headers.accept)?.includes('text/event-stream')) {
      return new Response(WHAT_THIS_IS, { headers: { 'content-type': 'text/plain; charset=utf-8' } });
    }

    let body: Buffer | undefined;
    try {
      body = await readBody(ctx);
    } catch {
      return jsonRpcError(413, 'That request is too large');
    }

    const request = new Request(new URL(raw.url ?? AGENT_PATH, inside), {
      method: raw.method ?? 'POST',
      headers: headersOf(ctx),
      ...(body ? { body: new Uint8Array(body) } : {})
    });

    if (session) {
      const entry = held.get(session);
      if (!entry) {
        return passOn(ctx, session, body);
      }

      entry.lastSeen = Date.now();
      void directory.hold(session);
      // Whatever it asks, its app is there: the wait for it to listen again starts over.
      unheard(session, entry);
      try {
        const response = await entry.transport.handleRequest(request);

        return raw.method === 'GET' && response.ok && response.body ? listening(session, entry, response) : response;
      } finally {
        entry.lastSeen = Date.now();
      }
    }

    if (held.size >= MAX_AGENTS) {
      return jsonRpcError(503, 'This Pizarra has as many agents as it can take right now — try again in a while');
    }

    // No session yet: this should be an `initialize`, which makes one. Anything else is refused by the transport, and
    // the agent it would have been never starts.
    const entry = open(ctx);
    await entry.agent.connect(entry.transport);
    const response = await entry.transport.handleRequest(request);
    if (entry.transport.sessionId === undefined) {
      await entry.transport.close();
    }

    return response;
  };

  return {
    stage: async ctx => {
      if (ctx.req.path.startsWith('/.well-known/oauth-')) {
        // An MCP client asking how to sign in, before it connects: nobody signs in to reach a board's agent.
        await send(ctx, new Response(null, { status: 404 }));

        return true;
      }

      if (ctx.req.path !== AGENT_PATH) {
        return false;
      }

      ctx.operation = `mcp ${ctx.raw.method ?? ''}`;
      const response = await answer(ctx);
      try {
        await send(ctx, response);
      } finally {
        ended.get(response)?.();
      }

      return true;
    },
    close: async () => {
      clearInterval(sweep);
      await Promise.all([...held.keys()].map(session => drop(session, 'the board’s server is restarting')));
    }
  };
};
