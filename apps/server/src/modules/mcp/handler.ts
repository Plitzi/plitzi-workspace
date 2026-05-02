import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';

import { createMcpServer } from './server';

import type { McpServerConfig } from '@plitzi/sdk-shared';
import type { IncomingMessage, ServerResponse } from 'node:http';

const readBody = (req: IncomingMessage): Promise<unknown> =>
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

export const handleMcp = async (req: IncomingMessage, res: ServerResponse, config: McpServerConfig): Promise<void> => {
  // Each request gets its own stateless transport — no session state to manage.
  const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });
  const server = createMcpServer(config.adapters, config.tools);

  await server.connect(transport);

  if (req.method === 'POST') {
    let body: unknown;
    try {
      body = await readBody(req);
    } catch {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Invalid JSON body' }));
      return;
    }
    await transport.handleRequest(req, res, body);
  } else {
    await transport.handleRequest(req, res);
  }
};
