import { createServer } from 'node:http';

import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';

import { handleMcp } from '../handler';

import type { SSRAdapters, SSRRequest } from '@plitzi/sdk-shared';
import type { IncomingMessage, Server } from 'node:http';

/** A live MCP endpoint on loopback — the same handler a deployment serves, transport and all. */
export interface McpEndpoint {
  url: string;
  client: Client;
  /** Raw fetch, for the probes a connector fires outside the JSON-RPC session. */
  request: (init?: RequestInit & { path?: string }) => Promise<Response>;
  close: () => Promise<void>;
}

export interface AppPage {
  html: string;
  mimeType?: string;
  meta?: Record<string, unknown>;
}

// The render pipeline these two belong to is not served here, so they throw instead of returning a fake.
const unreachable = (name: string) => (): never => {
  throw new Error(`${name} must never be called on the public MCP surface`);
};

const publicAdapters: SSRAdapters = {
  getOfflineData: unreachable('getOfflineData'),
  getSpaceDeployment: unreachable('getSpaceDeployment')
};

export interface McpEndpointOptions {
  /** Attach a space to the connection, the way an authorized connector's token does — the server then offers its
   *  editing surface. Omitted, the endpoint is the guest one: no space, so only what works without one. */
  spaceId?: number;
  /** The deployment switch a consumer sets as `mcpAi.renderStreaming`. Omitted, the server's own default stands. */
  renderStreaming?: boolean;
}

const toSsrRequest = (raw: IncomingMessage): SSRRequest => {
  const url = new URL(raw.url ?? '/', `http://${raw.headers.host ?? 'localhost'}`);

  return {
    method: raw.method ?? 'GET',
    path: url.pathname,
    search: url.search,
    url: url.toString(),
    hostname: url.hostname,
    protocol: 'http',
    headers: raw.headers,
    query: Object.fromEntries(url.searchParams),
    ctx: {}
  };
};

const listen = (server: Server): Promise<number> =>
  new Promise(resolve => {
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      resolve(typeof address === 'object' && address ? address.port : 0);
    });
  });

/** Start the endpoint and connect a real MCP client to it, as a remote connector does. */
export const startMcpEndpoint = async ({ spaceId, renderStreaming }: McpEndpointOptions = {}): Promise<McpEndpoint> => {
  const adapters: SSRAdapters =
    spaceId === undefined
      ? publicAdapters
      : {
          ...publicAdapters,
          getGrant: () => Promise.resolve({ spaceId, scope: 'agent' as const, canWrite: true })
        };
  const server = createServer((raw, res) => {
    void handleMcp(raw, res, toSsrRequest(raw), adapters, { renderStreaming });
  });
  const port = await listen(server);
  const url = `http://127.0.0.1:${port}/`;

  const client = new Client({ name: 'e2e-host', version: '1.0.0' });
  await client.connect(new StreamableHTTPClientTransport(new URL(url)));

  return {
    url,
    client,
    request: ({ path = '/', ...init } = {}) => fetch(new URL(path, url), init),
    close: async () => {
      await client.close();
      await new Promise<void>(resolve => server.close(() => resolve()));
    }
  };
};

/** Read a ui:// resource. A page that came back as a blob is a bug a host would meet as a blank frame. */
export const readAppPage = async (endpoint: McpEndpoint, uri: string): Promise<AppPage> => {
  const { contents } = await endpoint.client.readResource({ uri });
  const [page] = contents;
  if (!('text' in page)) {
    throw new Error(`${uri} did not come back as text`);
  }

  return { html: page.text, mimeType: page.mimeType, meta: page._meta };
};
