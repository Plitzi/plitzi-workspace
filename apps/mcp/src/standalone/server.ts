import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { consoleLogger } from '@plitzi/sdk-server/kernel';

import { createMCPServer } from '../server/mcpServer';

import type { Schema, SSRAdapters, SSRSpaceDeployment, Style } from '@plitzi/sdk-shared';

// The lib build replaces `VERSION` with the package version (see vite.config.ts `define`); running the sources
// through tsx there is no such replacement, and the MCP server reports it in its handshake.
(globalThis as typeof globalThis & { VERSION?: string }).VERSION ??= 'dev';

const PORT = parseInt(process.env.MCP_PORT ?? '3003', 10);
const HOST = process.env.MCP_HOST ?? '0.0.0.0';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const spacePath = () => path.resolve(__dirname, 'schemas/basic', 'space.json');
const stylePath = () => path.resolve(__dirname, 'schemas/basic', 'style.json');

const readSchema = (): Schema => (JSON.parse(readFileSync(spacePath(), 'utf-8')) as { schema: Schema }).schema;
const readStyle = (): Style => JSON.parse(readFileSync(stylePath(), 'utf-8')) as Style;

// mcp-ai reads/writes schema and style as separate documents (see SSRAdapters). The stub always resolves
// spaceId=1, and writes land back in the sample space — git-restore to reset a session.
const getSpaceId = (): Promise<number> => Promise.resolve(1);
const getSchema = (): Promise<Schema> => Promise.resolve(readSchema());
const getStyle = (): Promise<Style> => Promise.resolve(readStyle());
const saveSchema = (_spaceId: number, _environment: string, schema: Schema): Promise<void> => {
  writeFileSync(spacePath(), JSON.stringify({ schema }, null, 2));

  return Promise.resolve();
};
const saveStyle = (_spaceId: number, _environment: string, style: Style): Promise<void> => {
  writeFileSync(stylePath(), JSON.stringify(style, null, 2));

  return Promise.resolve();
};

// getOfflineData and getSpaceDeployment are what the SSR renderer reads; mcp-ai itself never calls either, but
// the adapter shape is shared across every Plitzi server.
const getOfflineData = () => Promise.resolve({ schema: readSchema(), style: readStyle() });
const getSpaceDeployment = (): Promise<SSRSpaceDeployment> =>
  Promise.resolve({ spaceId: 1, environment: 'main', revision: 0, pluginNames: [] });

const adapters: SSRAdapters = {
  getOfflineData,
  getSpaceDeployment,
  getSpaceId,
  getSchema,
  getStyle,
  saveSchema,
  saveStyle
};

// A dedicated MCP server, which is the shape a real MCP deployment has: it owns its whole sub-domain and answers
// JSON-RPC on every path rather than under /mcp. To exercise MCP alongside pages on one port instead, hand
// `mcpExtensions()` to createServer from @plitzi/sdk-server — that is the other supported topology.
const server = createMCPServer({
  port: PORT,
  host: HOST,
  httpVersion: 1,
  devMode: process.env.NODE_ENV !== 'production',
  // This is the package's own dev harness, so the log is always on: every tool call and resource read shows up
  // in the terminal. Set LOG_REQUESTS=0 for a quiet run.
  logger: process.env.LOG_REQUESTS === '0' ? undefined : consoleLogger,
  adapters
});

console.log(`[standalone] mcp-ai listening on ${HOST}:${PORT}`);

server.listen(PORT, HOST);
