import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';

import { createMcpServer } from './server';

import type { PreviewClient, ScreenshotClient } from './types';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { SSRAdapters, SSRRequest, ServerLogger } from '@plitzi/sdk-shared';
import type { IncomingMessage, ServerResponse } from 'node:http';

/** Per-request wiring the MCP service does not resolve itself: the renderer clients and the log sink. Everything
 *  here is optional — the service degrades feature by feature. */
export type McpRequestOptions = {
  preview?: PreviewClient;
  screenshot?: ScreenshotClient;
  logger?: ServerLogger;
};

export const readMcpBody = (req: IncomingMessage): Promise<unknown> =>
  new Promise((resolve, reject) => {
    let raw = '';
    req.on('data', (chunk: Buffer) => {
      raw += chunk.toString();
    });
    req.on('end', () => {
      try {
        resolve(raw ? (JSON.parse(raw) as unknown) : undefined);
      } catch {
        reject(new Error('MCP: invalid JSON body'));
      }
    });
    req.on('error', reject);
  });

// What the request did, for the server's access log: the JSON-RPC method carries the meaning ('initialize',
// 'tools/call') where the URL cannot — every call lands on the same path. Undefined when the body names none
// (a probe, a rejection, a malformed payload), which the path already describes.
const operationOf = (body: unknown): string | undefined => {
  if (Array.isArray(body)) {
    return `batch(${body.length})`;
  }

  if (typeof body === 'object' && body !== null && 'method' in body && typeof body.method === 'string') {
    return body.method;
  }

  return undefined;
};

// Drive one stateless request/response through a pre-built server. Callers that already hold the space
// (e.g. the gateway, which resolves it from the request JWT) build the server and use this directly. Returns the
// JSON-RPC method it served, for the caller's access log; the HTTP status is on the response.
export const serveMcp = async (
  raw: IncomingMessage,
  res: ServerResponse,
  server: McpServer
): Promise<string | undefined> => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', '*');
  res.setHeader('Access-Control-Max-Age', '86400');

  if (raw.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();

    return undefined;
  }

  // OAuth discovery probes: answer with a clean 404 ("this resource is unprotected, connect directly") instead of
  // letting the request fall through to the transport, which 406s on a non-event-stream Accept and can stall a
  // client's auth negotiation (Claude Desktop connectors probe these before connecting).
  if (raw.url?.startsWith('/.well-known/')) {
    res.writeHead(404);
    res.end();

    return undefined;
  }

  // The endpoint is stateless (JSON responses, no session), so it offers no server→client GET event stream. Reply
  // to any non-POST method with 405 rather than opening a stream that never resolves — an open GET otherwise HANGS
  // the client (Claude Desktop connectors, mcp-remote) until it times out. 405 is spec-compliant; clients handle it.
  if (raw.method !== 'POST') {
    res.writeHead(405, { 'Content-Type': 'application/json', Allow: 'POST, OPTIONS' });
    res.end(
      JSON.stringify({
        jsonrpc: '2.0',
        error: { code: -32000, message: 'Method not allowed; this MCP endpoint accepts JSON-RPC over POST only.' },
        id: null
      })
    );

    return undefined;
  }

  const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined, enableJsonResponse: true });
  await server.connect(transport);

  try {
    let body: unknown = (raw as { body?: unknown }).body;
    if (body === undefined) {
      try {
        body = await readMcpBody(raw);
      } catch {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Invalid JSON body' }));

        return undefined;
      }
    }

    await transport.handleRequest(raw, res, body);

    return operationOf(body);
  } finally {
    await transport.close();
  }
};

// The MCP service is stateless: the spaceId comes from the request's verified `Authorization` bearer (the
// consumer owns the JWT secret, so it decodes in getSpaceId). It is resolved lazily — never at connect time —
// so unauthenticated clients (MCP Inspector, capability probes) can still handshake and list tools/resources
// and read the public ones; only space-dependent tools/resources demand a spaceId. Reads/writes then go
// straight through the schema/style adapters — no deployment lookup, no in-memory space blob.
export const handleMcp = (
  raw: IncomingMessage,
  res: ServerResponse,
  req: SSRRequest,
  adapters: SSRAdapters,
  options: McpRequestOptions = {}
): Promise<string | undefined> =>
  serveMcp(
    raw,
    res,
    createMcpServer({
      adapters,
      getSpaceId: () => adapters.getSpaceId?.(req) ?? Promise.resolve(undefined),
      ...options
    })
  );

export { createMcpServer };
