import { randomUUID } from 'node:crypto';

import { WebStandardStreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js';

import { createAgentServer } from './server.ts';
import { parseLink } from './session.ts';
import { colourOfName } from '../board/people.ts';

import type { AgentServer } from './server.ts';
import type { Door } from './session.ts';
import type { AgentDirectory } from '../deployment.ts';

/**
 * Pizarra's agent, served by Pizarra's runtime: `/mcp`, over streamable HTTP — what the invite panel tells anyone on a board to
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

const firstOf = (value: string | null): string | undefined => value?.split(',')[0]?.trim() || undefined;

const jsonRpcError = (status: number, message: string): Response =>
  Response.json({ jsonrpc: '2.0', error: { code: -32000, message }, id: null }, { status });

/** A request's body, whole: small enough to hold, and read once whether it is answered here or passed on. */
const readBody = async (request: Request): Promise<Uint8Array<ArrayBuffer> | undefined> => {
  if (['GET', 'HEAD', 'DELETE', 'OPTIONS'].includes(request.method)) {
    return undefined;
  }

  const body = new Uint8Array(await request.arrayBuffer());
  if (body.byteLength > MAX_BODY_BYTES) {
    throw new Error('too large');
  }

  return body;
};

/** What every answer says to a browser-based client: anyone may ask, and may read the session it was given. */
const CORS = { 'access-control-allow-origin': '*', 'access-control-expose-headers': 'Mcp-Session-Id' };

/**
 * The answer, with `onEnd` called once its body is over — read to the end, or given up by its client. An event stream
 * stays open for as long as the app listens, and its end is how the agent learns the app went away.
 */
const endingWith = (response: Response, onEnd: () => void): Response => {
  const headers = new Headers(response.headers);
  Object.entries(CORS).forEach(([name, value]) => headers.set(name, value));
  if (!response.body) {
    onEnd();

    return new Response(null, { status: response.status, statusText: response.statusText, headers });
  }

  const reader = response.body.getReader();
  let over = false;
  const finish = (): void => {
    if (!over) {
      over = true;
      onEnd();
    }
  };
  const body = new ReadableStream<Uint8Array>({
    pull: async controller => {
      try {
        const { done, value } = await reader.read();
        if (done) {
          controller.close();
          finish();
        } else {
          controller.enqueue(value);
        }
      } catch (error) {
        controller.error(error);
        finish();
      }
    },
    cancel: async reason => {
      finish();
      await reader.cancel(reason);
    }
  });

  return new Response(body, { status: response.status, statusText: response.statusText, headers });
};

const WHAT_THIS_IS =
  'This is Pizarra’s endpoint for AI agents (MCP, streamable HTTP). Add this address to your agent — ' +
  '`claude mcp add --scope user --transport http pizarra <this address>`, `opencode mcp add pizarra --url <this address>`, ' +
  'or a custom connector in the Claude app — then send it a board’s link.';

export type AgentEndpoint = {
  /** `/mcp`, as a web handler: the runtime's endpoint on the platform, a stage on a server of its own. */
  handle: (request: Request) => Promise<Response>;
  /** Every agent off its board: the server is going away. */
  close: () => Promise<void>;
};

export const createAgentEndpoint = ({
  directory,
  publicUrl
}: {
  directory: AgentDirectory;
  /** This Pizarra's address — where its boards' links point, and where a hosted agent calls the boards' actions. */
  publicUrl: string;
}): AgentEndpoint => {
  const held = new Map<string, Held>();
  const publicOrigin = publicUrl.replace(/\/+$/, '');

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

  /**
   * Its app listening: the stream is counted while it is open — what this answers is called when it ends — and its end
   * starts the wait for the app to be back.
   */
  const listening = (session: string, entry: Held): (() => void) => {
    entry.streams += 1;
    entry.listened = true;
    clearTimeout(entry.gone);

    return () => {
      entry.streams -= 1;
      unheard(session, entry);
    };
  };

  /** A new agent: its server, and the transport that makes it a session once its client says `initialize`. */
  const open = (request: Request): Held => {
    const ip = firstOf(request.headers.get('x-forwarded-for'));
    // Who is asking, for what the board counts against a caller: the agent's client, not this runtime.
    const door: Door = { origin: publicOrigin, publicOrigin, ...(ip ? { headers: { 'x-forwarded-for': ip } } : {}) };
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
  const passOn = async (
    request: Request,
    session: string,
    body: Uint8Array<ArrayBuffer> | undefined
  ): Promise<Response> => {
    const owner = request.headers.get(FORWARDED) ? undefined : await directory.ownerOf(session);
    if (!owner || owner === directory.self) {
      // Gone with a replica that stopped, or forgotten after a long quiet: the client starts a new session.
      return jsonRpcError(404, 'Session not found — connect again');
    }

    const headers = new Headers(request.headers);
    for (const name of ['host', 'connection', 'content-length', 'transfer-encoding']) {
      headers.delete(name);
    }

    headers.set(FORWARDED, '1');
    const url = new URL(request.url);
    try {
      return await fetch(new URL(`${url.pathname}${url.search}`, owner), {
        method: request.method,
        headers,
        ...(body ? { body } : {}),
        signal: request.signal
      });
    } catch {
      // Its own client leaving is not the owner failing: the session is still there, for when it comes back.
      if (request.signal.aborted) {
        return new Response(null, { status: 499 });
      }

      await directory.release(session);

      return jsonRpcError(404, 'Session not found — connect again');
    }
  };

  /** An answer, and what to do once its body is over — for the stream an app listens on. */
  type Answered = { response: Response; onEnd?: () => void };

  const answer = async (request: Request): Promise<Answered> => {
    if (request.method === 'OPTIONS') {
      const response = new Response(null, {
        status: 204,
        headers: {
          'access-control-allow-methods': 'GET, POST, DELETE, OPTIONS',
          'access-control-allow-headers': '*',
          'access-control-max-age': '86400'
        }
      });

      return { response };
    }

    const session = firstOf(request.headers.get('mcp-session-id'));
    // Somebody opened the address in a browser: what it is, and what to do with it.
    if (
      request.method === 'GET' &&
      !session &&
      !firstOf(request.headers.get('accept'))?.includes('text/event-stream')
    ) {
      return { response: new Response(WHAT_THIS_IS, { headers: { 'content-type': 'text/plain; charset=utf-8' } }) };
    }

    let body: Uint8Array<ArrayBuffer> | undefined;
    try {
      body = await readBody(request);
    } catch {
      return { response: jsonRpcError(413, 'That request is too large') };
    }

    // Read once above — for passing on too — so the transport is handed a request with the body back in it.
    const asked = new Request(request.url, {
      method: request.method,
      headers: request.headers,
      ...(body ? { body } : {})
    });

    if (session) {
      const entry = held.get(session);
      if (!entry) {
        return { response: await passOn(request, session, body) };
      }

      entry.lastSeen = Date.now();
      void directory.hold(session);
      // Whatever it asks, its app is there: the wait for it to listen again starts over.
      unheard(session, entry);
      try {
        const response = await entry.transport.handleRequest(asked);

        return request.method === 'GET' && response.ok && response.body
          ? { response, onEnd: listening(session, entry) }
          : { response };
      } finally {
        entry.lastSeen = Date.now();
      }
    }

    if (held.size >= MAX_AGENTS) {
      return {
        response: jsonRpcError(503, 'This Pizarra has as many agents as it can take right now — try again in a while')
      };
    }

    // No session yet: this should be an `initialize`, which makes one. Anything else is refused by the transport, and
    // the agent it would have been never starts.
    const entry = open(request);
    await entry.agent.connect(entry.transport);
    const response = await entry.transport.handleRequest(asked);
    if (entry.transport.sessionId === undefined) {
      await entry.transport.close();
    }

    return { response };
  };

  return {
    handle: async request => {
      const { response, onEnd } = await answer(request);

      return endingWith(response, onEnd ?? (() => undefined));
    },
    close: async () => {
      clearInterval(sweep);
      await Promise.all([...held.keys()].map(session => drop(session, 'the board’s server is restarting')));
    }
  };
};
