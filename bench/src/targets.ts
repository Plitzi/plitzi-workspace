import { rmSync } from 'node:fs';
import path from 'node:path';

import { compilePageServer, PAGE_SERVER_DIR } from './pageServer';
import { run } from './runtime/process';

import type { Scenario } from './load';

export type Target = {
  name: string;
  description: string;
  /** Working directory, relative to the workspace root. */
  cwd: string;
  /** Entry point, relative to `cwd`. */
  entry: string;
  env?: Record<string, string>;
  /** First path that must answer before the server counts as started. */
  ready: string;
  scenarios: Scenario[];
  /** Makes the target exist before it starts — a project generated fresh, for one. */
  prepare?: (workspaceRoot: string) => Promise<void>;
};

const page = (pagePath = '/', name = 'page'): Scenario => ({ name, method: 'GET', path: pagePath });

const CLI_SERVER_DIR = 'bench/.cache/cli-server';
/**
 * A server-mode project exactly as `plitzi create` writes it, generated again on every run so it is always today's
 * template, and built the way it is deployed. It lives inside the workspace so its `@plitzi/*` imports resolve to the
 * workspace's builds.
 */
const scaffoldCliServer = async (workspaceRoot: string): Promise<void> => {
  const dir = path.join(workspaceRoot, CLI_SERVER_DIR);
  rmSync(dir, { recursive: true, force: true });
  await run('node', [
    path.join(workspaceRoot, 'apps/cli/dist/index.js'),
    'create',
    dir,
    '--mode',
    'server',
    '--source',
    'local',
    '--package-manager',
    'npm',
    '--no-install'
  ]);
  // What a deployment runs: the project's own `build`, with the workspace's TypeScript.
  await run('node', [
    path.join(workspaceRoot, 'node_modules/typescript/bin/tsc'),
    '-p',
    path.join(dir, 'tsconfig.build.json')
  ]);
};

export const TARGETS: Target[] = [
  {
    name: 'sdk-server-render',
    description: 'sdk-server rendering every request (environment main: no page cache)',
    cwd: PAGE_SERVER_DIR,
    entry: 'pageServer.js',
    prepare: compilePageServer,
    env: { SPACE_ENVIRONMENT: 'main' },
    ready: '/',
    scenarios: [page()]
  },
  {
    name: 'sdk-server-cached',
    description: 'sdk-server serving a published environment from its page cache',
    cwd: PAGE_SERVER_DIR,
    entry: 'pageServer.js',
    prepare: compilePageServer,
    env: { SPACE_ENVIRONMENT: 'production' },
    ready: '/',
    scenarios: [
      page(),
      { name: 'sdk-js', method: 'GET', path: '/sdk-assets/plitzi-sdk.js' },
      { name: 'sdk-css', method: 'GET', path: '/sdk-assets/plitzi-sdk.css' },
      { name: 'health', method: 'GET', path: '/health' }
    ]
  },
  {
    name: 'cli-server',
    description: 'A server project as `plitzi create` writes it — the product as a self-hoster gets it',
    cwd: CLI_SERVER_DIR,
    // `start:prod`: the compiled server, no TypeScript in the process.
    entry: 'dist/main.js',
    prepare: scaffoldCliServer,
    ready: '/',
    scenarios: [page()]
  }
];

/** `all` is every target; names pick some. */
export const selectTargets = (names: string[]): Target[] => {
  if (names.length === 1 && names[0] === 'all') {
    return TARGETS;
  }

  return names.map(name => {
    const target = TARGETS.find(candidate => candidate.name === name);
    if (!target) {
      throw new Error(`Unknown target "${name}". Known: ${TARGETS.map(candidate => candidate.name).join(', ')}`);
    }

    return target;
  });
};
