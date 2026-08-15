/** Every server the suite can start, in one list.
 *
 *  Two kinds. The first two are the suite's OWN surfaces — a browser harness and a page server it controls
 *  completely — and they are what the testing categories run against, because a test that needs two features at
 *  once should not have to bend somebody's teaching example to get them.
 *
 *  The rest ARE those examples. They are checked, not built on: an example a new user is told to run is a promise,
 *  and the `examples` category is that promise being kept. Nothing else depends on them.
 *
 *  A target with a `gate` needs something this machine may not have — a database, an /etc/hosts entry — so it
 *  stays out of the default run instead of failing it. The gate's `hint` is what gets printed when a spec skips. */

import { targetsForRun } from './categories';

export type TargetGate = {
  /** Set this to `1` to include the target. */
  env: string;
  /** What the reader has to do first, phrased as an instruction. */
  hint: string;
};

export type Target = {
  id: string;
  /** Workspace package name — `yarn workspace <workspace> start` is what boots it, unless `command` says otherwise. */
  workspace: string;
  /** Overrides the default `start` script — for a workspace that serves more than one surface, or an example that
   *  has to be told which port to take. */
  command?: string;
  /** The suite never starts this one: it is somebody's own dev server, already running on its own port. Starting a
   *  second copy is what makes it hop to the next port and collide with a different app. */
  external?: boolean;
  /** Written the way the target actually listens. The node servers bind `127.0.0.1` explicitly; Vite binds the
   *  name `localhost`, which resolves to ::1 first on macOS — addressing either one by the other's spelling finds
   *  nothing listening. */
  origin: string;
  /** What this surface is for, one line. */
  what: string;
  gate?: TargetGate;
};

export const targets: Target[] = [
  {
    id: 'harness',
    workspace: '@plitzi/e2e',
    origin: 'http://127.0.0.1:5100',
    what: 'The browser harness — renders any schema handed to it, with no server behind it'
  },
  {
    id: 'server',
    workspace: '@plitzi/e2e',
    command: 'yarn workspace @plitzi/e2e start:server',
    origin: 'http://127.0.0.1:5200',
    what: 'The page server this suite owns — pages, RSC, draft preview and MCP, all on at once'
  },
  {
    id: 'auth-server',
    workspace: '@plitzi/e2e',
    command: 'yarn workspace @plitzi/e2e start:auth',
    origin: 'http://127.0.0.1:5201',
    what: 'The same server with people in it — guest and member pages, sessions, bindings onto the account'
  },
  {
    id: 'no-build',
    workspace: '@plitzi/example-render-no-build',
    command: 'PORT=5000 yarn workspace @plitzi/example-render-no-build start',
    origin: 'http://127.0.0.1:5000',
    what: 'A plain HTML file: no bundler, no build step',
    gate: {
      env: 'PLITZI_E2E_VENDOR',
      hint: 'run `yarn workspace @plitzi/plitzi-sdk build-vendor:prod`, then set PLITZI_E2E_VENDOR=1'
    }
  },
  {
    id: 'render',
    workspace: '@plitzi/example-render-offline',
    command: 'yarn workspace @plitzi/example-render-offline start --port 5001',
    origin: 'http://localhost:5001',
    what: 'The same render() call from a bundled app'
  },
  {
    id: 'react-component',
    workspace: '@plitzi/example-react-component',
    command: 'yarn workspace @plitzi/example-react-component start --port 5002',
    origin: 'http://localhost:5002',
    what: '<PlitziSdk> inside your own React tree'
  },
  {
    id: 'server-rendered',
    workspace: '@plitzi/example-ssr-pages',
    command: 'PORT=5003 yarn workspace @plitzi/example-ssr-pages start',
    origin: 'http://127.0.0.1:5003',
    what: 'The same space, rendered by the server'
  },
  {
    id: 'server-components',
    workspace: '@plitzi/example-ssr-rsc',
    command: 'PORT=5004 yarn workspace @plitzi/example-ssr-rsc start',
    origin: 'http://127.0.0.1:5004',
    what: 'Per-element server data via React Server Components'
  },
  {
    id: 'mcp-server',
    workspace: '@plitzi/example-mcp-server',
    command: 'PORT=5005 yarn workspace @plitzi/example-mcp-server start',
    origin: 'http://127.0.0.1:5005',
    what: 'A dedicated MCP server an agent edits the space through'
  },
  {
    id: 'ssr-preview',
    workspace: '@plitzi/example-ssr-mcp-preview',
    command: 'PORT=5006 yarn workspace @plitzi/example-ssr-mcp-preview start',
    origin: 'http://127.0.0.1:5006',
    what: 'MCP and pages on one port, plus draft preview'
  },
  {
    id: 'sessions',
    workspace: '@plitzi/example-with-users',
    command: 'PORT=5007 yarn workspace @plitzi/example-with-users start',
    origin: 'http://127.0.0.1:5007',
    what: 'Sign in, renew, sign out — over an account store you provide'
  },
  {
    id: 'mysql',
    workspace: '@plitzi/example-with-users-mysql',
    command: 'PORT=5008 yarn workspace @plitzi/example-with-users-mysql start',
    origin: 'http://127.0.0.1:5008',
    what: 'The same sessions, over a MySQL account store',
    gate: { env: 'PLITZI_E2E_MYSQL', hint: 'point MYSQL_URL at a reachable database, then set PLITZI_E2E_MYSQL=1' }
  },
  {
    id: 'builder',
    workspace: '@plitzi/plitzi-builder',
    /** Plain HTTP on a port of its own, so the same command works on a laptop and on a CI runner that has no
     *  `app.plitzi.local` and no locally-trusted certificate authority. A developer's own `yarn start` is
     *  untouched — it still serves HTTPS on 3000. */
    command: 'PLITZI_BUILDER_HTTP=1 PLITZI_BUILDER_PORT=8080 yarn workspace @plitzi/plitzi-builder start',
    /** 8080 rather than the 5xxx band the rest of the suite uses, for one reason: a space token is bound to the
     *  origins it was minted for, and this is one the platform already trusts. Anywhere else, a live run gets a
     *  401 on its first call until somebody adds the origin to PLATFORM_ORIGINS. */
    origin: 'http://127.0.0.1:8080',
    what: 'The visual builder — its own instance, never the one you are developing in',
    gate: {
      env: 'PLITZI_E2E_BUILDER',
      hint: 'set PLITZI_E2E_BUILDER=1 (live mode also needs the stack up and PLITZI_WEB_KEY/PLITZI_USER_KEY from `yarn token`)'
    }
  }
];

const byId = new Map(targets.map(target => [target.id, target]));

export const target = (id: string): Target => {
  const found = byId.get(id);
  if (!found) {
    throw new Error(`Unknown e2e target "${id}" — add it to e2e/targets.ts`);
  }

  return found;
};

/** A gated target is open when its env var is set; an ungated one always is. */
export const isOpen = (candidate: Target): boolean => !candidate.gate || process.env[candidate.gate.env] === '1';

/** Which targets this run boots.
 *
 *  Normally the categories decide: `--project=rsc` needs one server, so one server starts. `PLITZI_E2E_TARGETS`
 *  narrows it further by hand, for the times you are iterating on a single surface. */
const narrowedIds = (): string[] =>
  process.env.PLITZI_E2E_TARGETS?.split(',')
    .map(id => id.trim())
    .filter(Boolean) ?? [];

export const isSelected = (candidate: Target): boolean => {
  const byCategory = targetsForRun();
  const byHand = narrowedIds();

  return byCategory.includes(candidate.id) && (!byHand.length || byHand.includes(candidate.id));
};

/** Why a target's specs are being skipped, phrased as the thing to do about it. */
export const skipReason = (candidate: Target): string => {
  if (!isSelected(candidate)) {
    return `${candidate.id}: not in this run — drop --project / PLITZI_E2E_TARGETS to include it`;
  }

  return candidate.gate ? `${candidate.id}: ${candidate.gate.hint}` : '';
};

/** The targets this run starts a server for — and, through `describeTarget`, the only ones whose specs run. The
 *  two have to agree: a spec left running against a server that was never started fails on a refused connection,
 *  which says nothing about the code it was written to check. */
export const selectedTargets = (): Target[] => {
  narrowedIds().forEach(id => target(id));

  return targets.filter(candidate => isOpen(candidate) && isSelected(candidate) && !candidate.external);
};
