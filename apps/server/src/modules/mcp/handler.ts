import { createMcpServer } from './server';

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp';
import type { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import type { McpServerConfig } from '@plitzi/sdk-shared';
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

export const handleMcp = async (
  req: IncomingMessage,
  res: ServerResponse,
  config: McpServerConfig,
  server?: McpServer,
  transport?: StreamableHTTPServerTransport
): Promise<void> => {
  if (!server || !transport) {
    // Each request gets its own stateless transport — no session state to manage.
    ({ server, transport } = createMcpServer(config.adapters, config.tools, { sessionIdGenerator: undefined }));
  }

  await server.connect(transport);

  if (req.method === 'POST') {
    let body: unknown;
    // Express (and similar frameworks) may have already parsed the JSON body.
    // Use req.body when present to avoid re-reading a consumed stream.
    if ((req as { body?: unknown }).body !== undefined) {
      body = (req as { body?: unknown }).body;
    } else {
      try {
        body = await readMcpBody(req);
      } catch {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Invalid JSON body' }));

        return;
      }
    }

    await transport.handleRequest(req, res, body);
  } else {
    await transport.handleRequest(req, res);
  }
};
