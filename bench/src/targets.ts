import type { Scenario } from './load';

export type Runner = 'tsx' | 'node';

export type Target = {
  name: string;
  description: string;
  /** Working directory, relative to the workspace root. */
  cwd: string;
  /** Entry point, relative to `cwd`. */
  entry: string;
  /**
   * How the entry is run. `tsx` is how the examples document it; `node` is Node's own type stripping, which needs
   * every relative import to name its file — and loads no transpiler beside the server.
   */
  runner: Runner;
  env?: Record<string, string>;
  /** First path that must answer before the server counts as started. */
  ready: string;
  scenarios: Scenario[];
  /**
   * Why this target is left out of `all` — it needs something the bench does not start (a database, the cloud).
   * Still runnable by name when that something is there.
   */
  requires?: string;
};

const page = (path = '/', name = 'page'): Scenario => ({ name, method: 'GET', path });

const rsc = (location = '/'): Scenario => ({
  name: 'rsc',
  method: 'GET',
  path: `/_rsc?location=${encodeURIComponent(location)}`
});

export const TARGETS: Target[] = [
  {
    name: 'sdk-server-render',
    description: 'sdk-server rendering every request (environment main: no page cache)',
    cwd: 'bench',
    entry: 'targets/pageServer.ts',
    runner: 'node',
    env: { SPACE_ENVIRONMENT: 'main' },
    ready: '/',
    scenarios: [page()]
  },
  {
    name: 'sdk-server-cached',
    description: 'sdk-server serving a published environment from its page cache',
    cwd: 'bench',
    entry: 'targets/pageServer.ts',
    runner: 'node',
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
    name: 'server-rendered',
    description: 'examples/01-my-first-space/04-server-rendered',
    cwd: 'examples/01-my-first-space/04-server-rendered',
    entry: 'src/main.ts',
    runner: 'tsx',
    ready: '/',
    scenarios: [page()]
  },
  {
    name: 'server-components',
    description: 'examples/03-with-data/01-server-components: compiled plugins and RSC',
    cwd: 'examples/03-with-data/01-server-components',
    entry: 'src/main.ts',
    runner: 'tsx',
    ready: '/',
    scenarios: [page(), rsc()]
  },
  {
    name: 'sessions',
    description: 'examples/02-with-users/01-sessions: sign-in through the auth kernel',
    cwd: 'examples/02-with-users/01-sessions',
    entry: 'src/main.ts',
    runner: 'tsx',
    ready: '/',
    scenarios: [
      page(),
      {
        name: 'login',
        method: 'POST',
        path: '/auth/login',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ username: 'ada', password: 'password' })
      }
    ]
  },
  {
    name: 'actions-render',
    description: 'examples/05-with-server-actions/02-render: a render action behind every page',
    cwd: 'examples/05-with-server-actions/02-render',
    entry: 'src/main.ts',
    runner: 'tsx',
    ready: '/',
    scenarios: [page(), rsc()]
  },
  {
    name: 'blog',
    description: 'examples/06-full-examples/01-blog',
    cwd: 'examples/06-full-examples/01-blog',
    entry: 'src/main.ts',
    runner: 'tsx',
    ready: '/',
    scenarios: [page()]
  },
  {
    name: 'seismic',
    description: 'examples/06-full-examples/02-seismic',
    cwd: 'examples/06-full-examples/02-seismic',
    entry: 'src/main.ts',
    runner: 'tsx',
    ready: '/',
    scenarios: [page('/?window=day')]
  },
  {
    name: 'ceniza',
    description: 'examples/06-full-examples/03-ceniza: an authored space',
    cwd: 'examples/06-full-examples/03-ceniza',
    entry: 'src/main.ts',
    runner: 'tsx',
    ready: '/',
    scenarios: [page()]
  },
  {
    name: 'mcp-server',
    description: 'examples/04-with-an-agent/01-mcp-server',
    cwd: 'examples/04-with-an-agent/01-mcp-server',
    entry: 'src/main.ts',
    runner: 'tsx',
    ready: '/health',
    scenarios: [
      {
        name: 'tools-list',
        method: 'POST',
        path: '/',
        headers: { 'content-type': 'application/json', accept: 'application/json, text/event-stream' },
        body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/list' })
      }
    ]
  },
  {
    name: 'mysql',
    description: 'examples/02-with-users/02-mysql',
    cwd: 'examples/02-with-users/02-mysql',
    entry: 'src/main.ts',
    runner: 'tsx',
    ready: '/',
    scenarios: [page()],
    requires: 'a MySQL server'
  },
  {
    name: 'from-the-cloud',
    description: 'examples/01-my-first-space/05-from-the-cloud',
    cwd: 'examples/01-my-first-space/05-from-the-cloud',
    entry: 'src/main.ts',
    runner: 'tsx',
    ready: '/',
    scenarios: [page()],
    requires: 'a Plitzi cloud space and its credentials'
  }
];

/** `all` is every target that needs nothing the bench does not start; a name picks that target whatever it needs. */
export const selectTargets = (names: string[]): Target[] => {
  if (names.length === 1 && names[0] === 'all') {
    return TARGETS.filter(target => target.requires === undefined);
  }

  return names.map(name => {
    const target = TARGETS.find(candidate => candidate.name === name);
    if (!target) {
      throw new Error(`Unknown target "${name}". Known: ${TARGETS.map(candidate => candidate.name).join(', ')}`);
    }

    return target;
  });
};
