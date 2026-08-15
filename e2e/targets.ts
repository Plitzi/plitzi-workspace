/** Every browser-reachable surface of the monorepo, in one list.
 *
 *  This is the manifest Playwright starts servers from, and it is deliberately the same set the examples README
 *  publishes: an example that a new user is told to run is a promise, and a promise nothing checks is a promise
 *  that breaks. Adding an example here is what turns it into a checked one.
 *
 *  A target with a `gate` needs something this machine may not have — a database, an /etc/hosts entry — so it
 *  stays out of the default run instead of failing it. The gate's `hint` is what gets printed when a spec skips. */

export type TargetGate = {
  /** Set this to `1` to include the target. */
  env: string;
  /** What the reader has to do first, phrased as an instruction. */
  hint: string;
};

export type Target = {
  id: string;
  /** Workspace package name — `yarn workspace <workspace> start` is what boots it. */
  workspace: string;
  /** Written the way the target actually listens. The node examples bind `127.0.0.1` explicitly; Vite binds the
   *  name `localhost`, which resolves to ::1 first on macOS — addressing either one by the other's spelling finds
   *  nothing listening. */
  origin: string;
  /** What a reader gets out of this surface, one line. */
  what: string;
  gate?: TargetGate;
};

export const targets: Target[] = [
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
    id: 'harness',
    workspace: '@plitzi/e2e',
    origin: 'http://127.0.0.1:4100',
    what: 'Renders any schema handed to it — the surface visual specs drive'
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

/** Narrows the run while iterating: `PLITZI_E2E_TARGETS=render,harness yarn e2e` boots two servers instead of ten.
 *  Unset means every target, which is what a full run and CI both want. */
const requestedIds = (): string[] =>
  process.env.PLITZI_E2E_TARGETS?.split(',')
    .map(id => id.trim())
    .filter(Boolean) ?? [];

export const isSelected = (candidate: Target): boolean => {
  const requested = requestedIds();

  return !requested.length || requested.includes(candidate.id);
};

/** Why a target's specs are being skipped, phrased as the thing to do about it. */
export const skipReason = (candidate: Target): string => {
  if (!isSelected(candidate)) {
    return `${candidate.id}: not in PLITZI_E2E_TARGETS`;
  }

  return candidate.gate ? `${candidate.id}: ${candidate.gate.hint}` : '';
};

/** The targets this run boots a server for — and, through `describeTarget`, the only ones whose specs run. The two
 *  have to agree: a spec left running against a server that was never started fails on a refused connection, which
 *  says nothing about the code it was written to check. */
export const selectedTargets = (): Target[] => {
  requestedIds().forEach(id => target(id));

  return targets.filter(candidate => isOpen(candidate) && isSelected(candidate));
};
