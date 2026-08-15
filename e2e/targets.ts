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
  /** Overrides the default `start` script, for a workspace that serves more than one surface. */
  command?: string;
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
    origin: 'http://127.0.0.1:4100',
    what: 'The browser harness — renders any schema handed to it, with no server behind it'
  },
  {
    id: 'server',
    workspace: '@plitzi/e2e',
    command: 'yarn workspace @plitzi/e2e start:server',
    origin: 'http://127.0.0.1:4200',
    what: 'The page server this suite owns — pages, RSC, draft preview and MCP, all on at once'
  },
  {
    id: 'auth-server',
    workspace: '@plitzi/e2e',
    command: 'yarn workspace @plitzi/e2e start:auth',
    origin: 'http://127.0.0.1:4201',
    what: 'The same server with people in it — guest and member pages, sessions, bindings onto the account'
  },
  {
    id: 'no-build',
    workspace: '@plitzi/example-render-no-build',
    origin: 'http://127.0.0.1:4000',
    what: 'A plain HTML file: no bundler, no build step',
    gate: {
      env: 'PLITZI_E2E_VENDOR',
      hint: 'run `yarn workspace @plitzi/plitzi-sdk build-vendor:prod`, then set PLITZI_E2E_VENDOR=1'
    }
  },
  {
    id: 'render',
    workspace: '@plitzi/example-render-offline',
    origin: 'http://localhost:4001',
    what: 'The same render() call from a bundled app'
  },
  {
    id: 'react-component',
    workspace: '@plitzi/example-react-component',
    origin: 'http://localhost:4002',
    what: '<PlitziSdk> inside your own React tree'
  },
  {
    id: 'server-rendered',
    workspace: '@plitzi/example-ssr-pages',
    origin: 'http://127.0.0.1:4003',
    what: 'The same space, rendered by the server'
  },
  {
    id: 'server-components',
    workspace: '@plitzi/example-ssr-rsc',
    origin: 'http://127.0.0.1:4004',
    what: 'Per-element server data via React Server Components'
  },
  {
    id: 'mcp-server',
    workspace: '@plitzi/example-mcp-server',
    origin: 'http://127.0.0.1:4005',
    what: 'A dedicated MCP server an agent edits the space through'
  },
  {
    id: 'ssr-preview',
    workspace: '@plitzi/example-ssr-mcp-preview',
    origin: 'http://127.0.0.1:4006',
    what: 'MCP and pages on one port, plus draft preview'
  },
  {
    id: 'sessions',
    workspace: '@plitzi/example-with-users',
    origin: 'http://127.0.0.1:4007',
    what: 'Sign in, renew, sign out — over an account store you provide'
  },
  {
    id: 'mysql',
    workspace: '@plitzi/example-with-users-mysql',
    origin: 'http://127.0.0.1:4008',
    what: 'The same sessions, over a MySQL account store',
    gate: { env: 'PLITZI_E2E_MYSQL', hint: 'point MYSQL_URL at a reachable database, then set PLITZI_E2E_MYSQL=1' }
  },
  {
    id: 'builder',
    workspace: '@plitzi/plitzi-builder',
    origin: 'https://app.plitzi.local:3000',
    what: 'The visual builder itself',
    gate: {
      env: 'PLITZI_E2E_BUILDER',
      hint: 'add app.plitzi.local to /etc/hosts (see docs/en/local-setup.md), then set PLITZI_E2E_BUILDER=1'
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

  return targets.filter(candidate => isOpen(candidate) && isSelected(candidate));
};
