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

import { execSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import path from 'node:path';

import { targetsForRun } from './categories';
import { builderCredentials } from './credentials';

/** The prebuilt bundle the no-build example loads straight from a script tag. */
const VENDOR_BUNDLE = path.resolve(import.meta.dirname, '../apps/sdk/dist/plitzi-sdk-vendor.js');

/** Whether the public API the render example fetches can be reached from this machine.
 *
 *  That example's whole subject is a server-side call to a third party, so there is nothing to assert about it
 *  offline — and a suite that goes red on a train is one people learn to ignore. Asked once, like every other
 *  gate, and answered by the same request the example makes. */
let catApiUp: boolean | undefined;
const catApiReachable = (): boolean => {
  if (catApiUp === undefined) {
    try {
      execSync('curl -sfI --max-time 3 https://api.thecatapi.com/v1/images/search', { stdio: 'ignore' });
      catApiUp = true;
    } catch {
      catApiUp = false;
    }
  }

  return catApiUp;
};

export type TargetGate = {
  /** Whether this machine can run the target at all — asked, not declared, so there is no flag to remember. */
  open: () => boolean;
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
  /** Loaded once before the specs, because it is a Vite dev server: the first page load is what makes Vite
   *  discover and pre-bundle dependencies, and it charges that work to whoever asks first. See `warmUp.ts`. */
  warmUp?: boolean;
  gate?: TargetGate;
};

export const targets: Target[] = [
  {
    id: 'harness',
    workspace: '@plitzi/e2e',
    origin: 'http://127.0.0.1:5100',
    what: 'The browser harness — renders any schema handed to it, with no server behind it',
    warmUp: true
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
    id: 'action-server',
    workspace: '@plitzi/e2e',
    command: 'yarn workspace @plitzi/e2e start:actions',
    origin: 'http://127.0.0.1:5202',
    what: 'A page server wired for actions ALONE — no connectors, no RSC adapter of its own'
  },
  {
    id: 'no-build',
    workspace: '@plitzi/example-render-no-build',
    /** 5009 and not 5000: on macOS, port 5000 belongs to ControlCenter's AirPlay Receiver. Readiness here is an
     *  open socket, so a port somebody else already holds reads as "the server is up" — the example never starts,
     *  and the spec fails against a stranger's empty response with a blank screenshot and nothing to explain it. */
    command: 'PORT=5009 yarn workspace @plitzi/example-render-no-build start',
    origin: 'http://127.0.0.1:5009',
    what: 'A plain HTML file: no bundler, no build step',
    gate: {
      open: () => existsSync(VENDOR_BUNDLE),
      hint: 'run `yarn workspace @plitzi/plitzi-sdk build-vendor:prod` — this example loads the built bundle'
    }
  },
  {
    id: 'render',
    workspace: '@plitzi/example-render-offline',
    command: 'yarn workspace @plitzi/example-render-offline start --port 5001',
    origin: 'http://localhost:5001',
    what: 'The same render() call from a bundled app',
    warmUp: true
  },
  {
    id: 'react-component',
    workspace: '@plitzi/example-react-component',
    command: 'yarn workspace @plitzi/example-react-component start --port 5002',
    origin: 'http://localhost:5002',
    what: '<PlitziSdk> inside your own React tree',
    warmUp: true
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
    gate: { open: () => !!process.env.MYSQL_URL, hint: 'point MYSQL_URL at a reachable database' }
  },
  {
    id: 'server-actions',
    workspace: '@plitzi/example-server-actions',
    /** One command, two listeners: the example serves the PUBLISHED space here and its draft on the next port up,
     *  which is the only way to see the versioning rule rather than read about it. The spec derives the second
     *  origin from this one — Playwright only ever waits on the first. */
    command: 'PORT=5010 yarn workspace @plitzi/example-server-actions start',
    origin: 'http://127.0.0.1:5010',
    what: 'A declarative flow the server runs, called from a page'
  },
  {
    id: 'server-actions-render',
    workspace: '@plitzi/example-server-actions-render',
    command: 'PORT=5011 yarn workspace @plitzi/example-server-actions-render start',
    origin: 'http://127.0.0.1:5011',
    what: 'The server fetches an API while the page renders',
    gate: {
      open: catApiReachable,
      hint: 'this example fetches api.thecatapi.com while it renders — connect to the internet'
    }
  },
  {
    id: 'server-actions-no-server',
    workspace: '@plitzi/example-server-actions-no-server',
    command: 'yarn workspace @plitzi/example-server-actions-no-server start --port 5012',
    /** Vite binds the NAME localhost, which resolves to ::1 first on macOS — see the note on `origin` above. */
    origin: 'http://localhost:5012',
    what: 'The same space in the browser alone: every server-side step inert',
    warmUp: true
  },
  {
    id: 'builder',
    workspace: '@plitzi/plitzi-builder',
    /** Plain HTTP on a port of its own, so the same command works on a laptop and on a CI runner that has no
     *  `app.plitzi.local` and no locally-trusted certificate authority. A developer's own `yarn start` is
     *  untouched — it still serves HTTPS on 3000. */
    /** The credentials go in as environment, minted by the suite when nothing better was exported — so the
     *  builder boots with a token that is current rather than one pasted into `index.html` a day ago. */
    get command() {
      const { webKey, userKey } = builderCredentials();

      return `PLITZI_BUILDER_HTTP=1 PLITZI_BUILDER_PORT=8080 PLITZI_WEB_KEY=${webKey} PLITZI_USER_KEY=${userKey} yarn workspace @plitzi/plitzi-builder start`;
    },
    /** 8080 rather than the 5xxx band the rest of the suite uses, for one reason: a space token is bound to the
     *  origins it was minted for, and this is one the platform already trusts. Anywhere else, a live run gets a
     *  401 on its first call until somebody adds the origin to PLATFORM_ORIGINS. */
    origin: 'http://127.0.0.1:8080',
    /** No gate: mocked it needs nothing, so it always runs. Exporting a token from `yarn token 1 --user admin`
     *  is what upgrades the same specs to a real server. */
    what: 'The visual builder — its own instance, never the one you are developing in',
    /** The one that needs it most: the largest module graph in the repo, and the only target whose whole category
     *  failed on a cold dependency cache. */
    warmUp: true
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

/** A gated target is open when whatever it needs is actually there; an ungated one always is. */
export const isOpen = (candidate: Target): boolean => !candidate.gate || candidate.gate.open();

/** Which targets this run boots.
 *
 *  Normally the categories decide: `--project=rsc` needs one server, so one server starts. `PLITZI_TARGETS`
 *  narrows it further by hand, for the times you are iterating on a single surface. */
const narrowedIds = (): string[] =>
  process.env.PLITZI_TARGETS?.split(',')
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
    return `${candidate.id}: not in this run — drop --project / PLITZI_TARGETS to include it`;
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
