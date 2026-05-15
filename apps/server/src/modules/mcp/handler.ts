import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';

import { createMcpServer } from './server';
import AIEngine from '../ai/AIEngine';

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp';
import type { McpServerConfig, AiContext } from '@plitzi/sdk-shared';
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
  transport?: StreamableHTTPServerTransport,
  context?: AiContext
): Promise<void> => {
  if (!server) {
    const ctx: AiContext = context ?? { userId: 0, spaceId: 0, environment: 'main', mode: 'plan' };
    const engine = new AIEngine(ctx.mode, config.adapters, {}, ctx);
    server = createMcpServer(config.adapters, engine, config.tools, config.prompts);
  }

  if (!transport) {
    transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined, enableJsonResponse: true });
  }

  await server.connect(transport);

  try {
    if (req.method === 'POST') {
      let body: unknown;
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
  } finally {
    await transport.close();
  }
};
