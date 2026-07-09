import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp';

import { emptySpaceMessage } from './helpers';
import { createMcpServer } from './server';

import type { McpState } from './server';
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

// Resolve the two schemas this request targets from the SSR adapters. The SSR adapter persists the whole
// OfflineDataRaw at once, so each schema persister writes back a shared, up-to-date copy (last write wins).
// Returns undefined when the deployment has no offline data, so the caller can answer accordingly.
const loadState = async (req: SSRRequest, adapters: SSRAdapters): Promise<McpState | undefined> => {
  const deployment = await adapters.getSpaceDeployment(req);
  const env = deployment.environment ?? 'main';
  const spaceId = deployment.spaceId ?? 0;
  const offlineData = await adapters.getOfflineData(spaceId, env, deployment.revision);
  if (!offlineData) {
    return undefined;
  }

  const { saveOfflineData } = adapters;
  const current = { ...offlineData };

  return {
    env,
    schema: offlineData.schema,
    style: offlineData.style,
    persistSchema: saveOfflineData
      ? schema => {
          current.schema = schema;

          return saveOfflineData(spaceId, env, current);
        }
      : undefined,
    persistStyle: saveOfflineData
      ? style => {
          current.style = style;

          return saveOfflineData(spaceId, env, current);
        }
      : undefined
  };
};

export const handleMcp = async (
  raw: IncomingMessage,
  res: ServerResponse,
  req: SSRRequest,
  adapters: SSRAdapters
): Promise<void> => {
  const state = await loadState(req, adapters);
  if (!state) {
    res.writeHead(503, { 'Content-Type': 'text/plain' });
    res.end(emptySpaceMessage);

    return;
  }

  await serveMcp(raw, res, createMcpServer(state));
};

export { createMcpServer };
