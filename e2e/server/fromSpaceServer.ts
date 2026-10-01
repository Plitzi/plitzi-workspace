import { spawn } from 'node:child_process';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';

import { authorSpace, defineAction, specFromSpace, specToSource } from '@plitzi/sdk-authoring';

import { FUNCTION_FILES, SOURCE_FILES, TALLY_TYPE, tallyDeclaration } from './fromSpace/source';
import { tallySpec } from '../spaces/fromSpace';

import type { SpaceExport } from '@plitzi/sdk-shared/source';

/**
 * A space taken out of Plitzi with `plitzi create --from`, served by the project the CLI wrote — the whole way back
 * (docs/en/projects-from-spaces.md), and the one nothing else runs end to end: the export as the platform answers it, the CLI that writes a
 * project from it, and that project serving the space with nothing of Plitzi's behind it — its pages, its plugin
 * rebuilt from source and rendered on the server, its runtime, its action and function, and its files.
 *
 * The platform is a small one of its own, on the next port up: the CLI signs in to it and asks for the export, and its
 * CDN serves the space's picture once, for the project to keep. Generated on every start, inside the workspace, so the
 * project runs on the workspace's builds — what the next release hands anybody, never what npm has.
 */

export const PORT = Number(process.env.PORT ?? 5209);
/** The platform the space is taken out of. */
export const PLATFORM_PORT = PORT + 100;

const WORKSPACE = path.resolve(import.meta.dirname, '../..');
const ARTIFACTS = path.join(WORKSPACE, 'e2e/.artifacts');
const PROJECT_DIR = path.join(ARTIFACTS, 'from-space');
const CONFIG_DIR = path.join(ARTIFACTS, 'from-space-config');
const CLI = path.join(WORKSPACE, 'apps/cli/dist/index.js');
const PLATFORM = `http://127.0.0.1:${String(PLATFORM_PORT)}`;
const CDN = `${PLATFORM}/cdn`;

if (!fs.existsSync(CLI)) {
  throw new Error(`[e2e] ${CLI} is missing — build the CLI first (yarn workspace @plitzi/cli build:dev).`);
}

const DOT = '<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32"><circle cx="16" cy="16" r="15"/></svg>';

const addOne = defineAction({
  id: 'tally-add',
  name: 'Add one',
  trigger: { type: 'call', access: 'public' },
  steps: [{ id: 'added', task: 'tally.add', params: {} }]
});

/** The space put together as `GET /spaces/:id/export` answers it — its pages decompiled as the platform does. */
const exportOf = (source: 'local' | 'cloud'): SpaceExport => {
  const documents = authorSpace(tallySpec(CDN), { plugins: [tallyDeclaration] });
  const { spec } = specFromSpace(documents, { pluginTypes: [TALLY_TYPE] });
  const encode = (text: string): string => Buffer.from(text).toString('base64');

  return {
    format: 1,
    space: { id: 7, name: 'Tally', permanentUrl: 'tally' },
    authoring:
      source === 'local'
        ? {
            exportName: 'tally',
            files: specToSource(spec, { exportName: 'tally', split: true, importExtension: '.ts' })
          }
        : null,
    actions: [{ identifier: addOne.id, name: addOne.document.name, document: addOne.document }],
    connectors: [],
    functions: { version: 'v1', files: FUNCTION_FILES },
    source: {
      files: Object.fromEntries(Object.entries(SOURCE_FILES).map(([file, text]) => [file, encode(text)])),
      dependencies: {},
      runtime: { entries: ['runtime.ts'] },
      plugins: [{ type: TALLY_TYPE, entries: ['plugins/Tally/index.ts'] }]
    },
    builtOnly: { plugins: [], runtime: null },
    assets: [{ url: `${CDN}/tally/assets/dot.svg`, path: 'assets/dot.svg' }],
    variables: [],
    credentials: [],
    visitorRoles: [],
    report: { conflicts: [], rangeConflicts: [], corrections: [] }
  };
};

const platform = http.createServer((req, res) => {
  const url = new URL(req.url ?? '/', PLATFORM);
  const json = (status: number, body: unknown): void => {
    res.writeHead(status, { 'Content-Type': 'application/json' }).end(JSON.stringify(body));
  };

  if (url.pathname === '/cdn/tally/assets/dot.svg') {
    res.writeHead(200, { 'Content-Type': 'image/svg+xml' }).end(DOT);
  } else if (req.headers.authorization !== 'Bearer e2e-session') {
    json(401, { error: 'Not authenticated' });
  } else if (url.pathname === '/auth/session') {
    json(200, { success: true, details: { email: 'ada@example.test' } });
  } else if (url.pathname === '/spaces/tally/export') {
    json(200, exportOf(url.searchParams.get('source') === 'cloud' ? 'cloud' : 'local'));
  } else {
    json(404, { error: 'Not found' });
  }
});
await new Promise<void>(resolve => platform.listen(PLATFORM_PORT, '127.0.0.1', resolve));

// Signed in as a person is, through the file `plitzi login` writes.
fs.rmSync(PROJECT_DIR, { recursive: true, force: true });
fs.rmSync(CONFIG_DIR, { recursive: true, force: true });
fs.mkdirSync(path.join(CONFIG_DIR, 'plitzi'), { recursive: true });
fs.writeFileSync(
  path.join(CONFIG_DIR, 'plitzi/connection.json'),
  JSON.stringify({ api: PLATFORM, grant: { clientId: 'e2e', accessToken: 'e2e-session' } })
);

/**
 * As an agent would run it: nobody at the terminal, so every choice is passed. Not `spawnSync`: the platform it asks
 * for the space answers from this very process, which a synchronous wait would hold still.
 */
const created = await new Promise<{ status: number | null; output: string }>(resolve => {
  const cli = spawn(
    'node',
    [
      CLI,
      'create',
      PROJECT_DIR,
      '--from',
      'tally',
      '--api',
      PLATFORM,
      '--source',
      'local',
      '--package-manager',
      'npm',
      '--no-install'
    ],
    { cwd: WORKSPACE, env: { ...process.env, XDG_CONFIG_HOME: CONFIG_DIR } }
  );
  let output = '';
  cli.stdout.on('data', (chunk: Buffer) => (output += chunk.toString('utf-8')));
  cli.stderr.on('data', (chunk: Buffer) => (output += chunk.toString('utf-8')));
  cli.once('close', status => resolve({ status, output }));
});
if (created.status !== 0) {
  throw new Error(`[e2e] plitzi create --from failed:\n${created.output}`);
}

// The project's own start, as its README says — no install: inside the workspace it resolves the workspace's packages.
const project = spawn('node', ['src/main.ts'], {
  cwd: PROJECT_DIR,
  env: { ...process.env, PORT: String(PORT), HOST: '127.0.0.1', NODE_ENV: 'development' },
  stdio: 'inherit'
});

const stop = (): void => {
  project.kill('SIGTERM');
  platform.close();
};
process.once('SIGTERM', stop);
process.once('SIGINT', stop);
project.once('exit', code => {
  platform.close();
  process.exitCode = code ?? 0;
});
console.log(`[e2e] a space taken out with plitzi create --from, served by its project on http://127.0.0.1:${PORT}/`);
