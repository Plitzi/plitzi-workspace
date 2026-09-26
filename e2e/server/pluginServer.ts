import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';

import { authorSpace } from '@plitzi/sdk-authoring';
import { closeOnSignals, createJsonAdapters, createServer } from '@plitzi/sdk-server';

import type { SpaceSpec } from '@plitzi/sdk-authoring';

/**
 * A plugin package exactly as `plitzi create --plugin` writes it, built, published on a host of its own and loaded by a
 * page from its manifest — the whole path a plugin somebody writes travels, and the one nothing else exercises: the
 * CLI's template, the build's manifest and externals, the browser reading a manifest across origins, and the SDK
 * turning an element of the plugin's type into the component it fetched.
 *
 * Generated on every start, so it is always today's template. Inside the workspace, so its `@plitzi/*` imports resolve to
 * the workspace's builds — the build it gets is what the CLI would hand anybody.
 */

export const PORT = Number(process.env.PORT ?? 5208);
/** Where the plugin is published: a CDN in miniature, on an origin of its own as a real one is. */
export const PLUGIN_HOST_PORT = PORT + 100;

const WORKSPACE = path.resolve(import.meta.dirname, '../..');
const PLUGIN_DIR = path.join(WORKSPACE, 'e2e/.artifacts/cli-plugin');
const DIST = path.join(PLUGIN_DIR, 'dist');
const CLI = path.join(WORKSPACE, 'apps/cli/dist/index.js');

const run = (command: string, args: string[], cwd: string): void => {
  const { status, stderr } = spawnSync(command, args, { cwd, encoding: 'utf-8' });
  if (status !== 0) {
    throw new Error(`[e2e] ${[command, ...args].join(' ')} failed:\n${stderr}`);
  }
};

if (!fs.existsSync(CLI)) {
  throw new Error(`[e2e] ${CLI} is missing — build the CLI first (yarn workspace @plitzi/cli build:dev).`);
}

fs.rmSync(PLUGIN_DIR, { recursive: true, force: true });
// As an agent would run it: nobody at the terminal, so every choice that shapes the package is passed.
run(
  'node',
  [
    CLI,
    'create',
    PLUGIN_DIR,
    '--plugin',
    '--name',
    'plitzi-plugin-seat-picker',
    '--title',
    'Seat Picker',
    '--description',
    'Counts seats.',
    '--package-manager',
    'npm',
    '--no-install'
  ],
  WORKSPACE
);
// Built the way the package's own `build` builds it: by the CLI.
run('node', [CLI, 'pack', 'plugin', '--no-zip'], PLUGIN_DIR);

const TYPES: Record<string, string> = { '.json': 'application/json', '.mjs': 'text/javascript', '.css': 'text/css' };

/**
 * Serves `dist/` as a bucket does: files, and CORS open to reads from anywhere. Nothing more — no preflight answered —
 * because a host that only allows plain cross-origin reads is the usual one, and a page that needed more would fail
 * on it.
 */
const pluginHost = http.createServer((req, res) => {
  const file = path.join(DIST, path.normalize(decodeURIComponent((req.url ?? '/').split('?')[0])));
  if (req.method !== 'GET' || !file.startsWith(DIST) || !fs.existsSync(file)) {
    res.statusCode = 404;
    res.end();

    return;
  }

  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Content-Type', TYPES[path.extname(file)] ?? 'application/octet-stream');
  fs.createReadStream(file).pipe(res);
});
pluginHost.listen(PLUGIN_HOST_PORT, '127.0.0.1');

// The package's own preview space, which hosts the plugin as an element of its type — as a published space does.
const { space } = (await import(path.join(PLUGIN_DIR, 'preview/space.ts'))) as { space: SpaceSpec };
const { schema, style } = authorSpace(space, { pluginTypes: ['seatPicker'] });

const server = createServer({
  port: PORT,
  adapters: createJsonAdapters({
    offlineData: {
      schema,
      style,
      plugins: [{ type: 'seatPicker', resource: `http://127.0.0.1:${PLUGIN_HOST_PORT}`, settings: {} }]
    },
    deployment: { spaceId: 1, environment: 'main', revision: 0 }
  })
});

server.listen(PORT, '127.0.0.1');
closeOnSignals(server);
console.log(`[e2e] a space loading a CLI-built plugin on http://127.0.0.1:${PORT}/`);
