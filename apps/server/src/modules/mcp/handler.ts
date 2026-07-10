import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp';

import { createMcpServer } from './server';

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp';
import type { SSRAdapters, SSRRequest } from '@plitzi/sdk-shared';
import type { IncomingMessage, ServerResponse } from 'node:http';

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

// Drive one stateless request/response through a pre-built server. Callers that already hold the space
// (e.g. the gateway, which resolves it from the request JWT) build the server and use this directly.
export const serveMcp = async (raw: IncomingMessage, res: ServerResponse, server: McpServer): Promise<void> => {
  const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined, enableJsonResponse: true });
  await server.connect(transport);

  try {
    if (raw.method === 'POST') {
      let body: unknown = (raw as { body?: unknown }).body;
      if (body === undefined) {
        try {
          body = await readMcpBody(raw);
        } catch {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Invalid JSON body' }));

          return;
        }
      }

      await transport.handleRequest(raw, res, body);
    } else {
      await transport.handleRequest(raw, res);
    }
  } finally {
    await transport.close();
  }
};

// The MCP service is stateless: the spaceId comes from the request's verified `Authorization` bearer (the
// consumer owns the JWT secret, so it decodes in getSpaceId). Reads/writes then go straight through the
// schema/style adapters — no deployment lookup, no in-memory space blob.
export const handleMcp = async (
  raw: IncomingMessage,
  res: ServerResponse,
  req: SSRRequest,
  adapters: SSRAdapters
): Promise<void> => {
  const spaceId = await adapters.getSpaceId?.(req);
  if (!spaceId) {
    res.writeHead(401, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Unauthorized: no spaceId resolved from the Authorization token' }));

    return;
  }

  await serveMcp(raw, res, createMcpServer({ adapters, spaceId }));
};

export { createMcpServer };
