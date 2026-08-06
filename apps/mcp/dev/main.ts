import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { consoleLogger } from '@plitzi/sdk-server/kernel';

import { createServer } from '../src/server';

import type { Schema, SSRAdapters, SSRSpaceDeployment, Style } from '@plitzi/sdk-shared';

// The lib build replaces `VERSION` with the package version (see vite.config.ts `define`); running the sources
// through tsx there is no such replacement, and the MCP server reports it in its handshake.
(globalThis as typeof globalThis & { VERSION?: string }).VERSION ??= 'dev';

const PORT = parseInt(process.env.MCP_PORT ?? '3003', 10);
const HOST = process.env.MCP_HOST ?? '0.0.0.0';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const spacePath = () => path.resolve(__dirname, 'sample', 'space.json');
const stylePath = () => path.resolve(__dirname, 'sample', 'style.json');

const readSchema = (): Schema => (JSON.parse(readFileSync(spacePath(), 'utf-8')) as { schema: Schema }).schema;
const readStyle = (): Style => JSON.parse(readFileSync(stylePath(), 'utf-8')) as Style;

// mcp-ai reads and writes schema and style as separate documents (see SSRAdapters). These file-backed adapters
// always resolve spaceId=1, and writes land back in the sample space — git-restore it to reset a session.
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

// getOfflineData and getSpaceDeployment are what an SSR renderer reads; mcp-ai calls neither, but the adapter
// shape is shared by every Plitzi server.
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

const server = createServer({
  port: PORT,
  host: HOST,
  httpVersion: 1,
  devMode: process.env.NODE_ENV !== 'production',
  // Running the package directly is a development activity, so the log is on by default: every tool call and
  // resource read shows up in the terminal. Set LOG_REQUESTS=0 for a quiet run.
  logger: process.env.LOG_REQUESTS === '0' ? undefined : consoleLogger,
  adapters
});

server.listen(PORT, HOST);
