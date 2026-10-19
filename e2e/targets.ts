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
import { BUILDER_ORIGIN, PORTS } from './launchConfig';

/** Whether the MySQL the mysql example connects to answers — the one IT reads, not a variable of the suite's own.
 *
 *  The example takes `DATABASE_URL`, or `MYSQL_HOST`/`MYSQL_PORT` with 127.0.0.1:33006 (a local docker MySQL) as the
 *  default, and makes its own database. The gate used to ask for a `MYSQL_URL` nothing read: the example was skipped on
 *  a machine whose docker was up, and exporting the variable opened it without changing where it connected. */
let mysqlUp: boolean | undefined;
const mysqlReachable = (): boolean => {
  if (mysqlUp === undefined) {
    const url = process.env.DATABASE_URL ? new URL(process.env.DATABASE_URL) : undefined;
    const host = url?.hostname ?? process.env.MYSQL_HOST ?? '127.0.0.1';
    const port = url?.port || process.env.MYSQL_PORT || '33006';
    try {
      execSync(`nc -z -w 2 ${host} ${port}`, { stdio: 'ignore' });
      mysqlUp = true;
    } catch {
      mysqlUp = false;
    }
  }

  return mysqlUp;
};

/** The prebuilt bundle the no-build example loads straight from a script tag. */
const VENDOR_BUNDLE = path.resolve(import.meta.dirname, '../apps/sdk/dist/plitzi-sdk-vendor.js');

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
    origin: `http://127.0.0.1:${String(PORTS.harness)}`,
    what: 'The browser harness — renders any schema handed to it, with no server behind it',
    warmUp: true
  },
  {
    id: 'desktop',
    workspace: '@plitzi/plitzi-desktop',
    /** The renderer's Vite server alone. The package's own `start` also opens an Electron window, which a browser
     *  suite has no use for. 5180 because that is the origin the platform already lists in PLATFORM_ORIGINS. */
    command: 'yarn workspace @plitzi/plitzi-desktop vite dev --mode development',
    origin: 'http://localhost:5180',
    what: 'The desktop window’s renderer — its chrome and the offline rail, in a plain browser',
    warmUp: true
  },
  {
    id: 'server',
    workspace: '@plitzi/e2e',
    command: 'yarn workspace @plitzi/e2e start:server',
    origin: `http://127.0.0.1:${String(PORTS.server)}`,
    what: 'The page server this suite owns — pages, RSC, draft preview and MCP, all on at once'
  },
  {
    id: 'auth-server',
    workspace: '@plitzi/e2e',
    command: 'yarn workspace @plitzi/e2e start:auth',
    origin: `http://127.0.0.1:${String(PORTS.authServer)}`,
    what: 'The same server with people in it — guest and member pages, sessions, bindings onto the account'
  },
  {
    id: 'action-server',
    workspace: '@plitzi/e2e',
    command: 'yarn workspace @plitzi/e2e start:actions',
    origin: `http://127.0.0.1:${String(PORTS.actionServer)}`,
    what: 'A page server wired for actions ALONE — no connectors, no RSC adapter of its own'
  },
  {
    id: 'published-server',
    workspace: '@plitzi/e2e',
    command: 'yarn workspace @plitzi/e2e start:published',
    origin: `http://127.0.0.1:${String(PORTS.published)}`,
    what: 'The action space as a PUBLISHED site: nobody authorized debugging, so nothing about its flows leaves it'
  },
  {
    id: 'devtools-server',
    workspace: '@plitzi/e2e',
    command: 'yarn workspace @plitzi/e2e start:published-devtools',
    origin: `http://127.0.0.1:${String(PORTS.publishedDevtools)}`,
    what: 'The same published site with the space’s own dev-tools setting on — the outline, and never a step’s data'
  },
  {
    id: 'flags-server',
    workspace: '@plitzi/e2e',
    command: 'yarn workspace @plitzi/e2e start:flags',
    origin: `http://127.0.0.1:${String(PORTS.flags)}`,
    what: 'The flags space as a published site: the server turns one flag on, and debugging is authorized'
  },
  {
    id: 'flags-no-debug-server',
    workspace: '@plitzi/e2e',
    command: 'yarn workspace @plitzi/e2e start:flags-no-debug',
    origin: `http://127.0.0.1:${String(PORTS.flagsNoDebug)}`,
    what: 'The same site where nobody authorized debugging — a tester’s forced flags are ignored'
  },
  {
    id: 'workers-server',
    workspace: '@plitzi/e2e',
    command: 'yarn workspace @plitzi/e2e start:workers',
    origin: `http://127.0.0.1:${String(PORTS.workers)}`,
    what: 'The sample space served by two processes on one port, as production uses a machine with several cores'
  },
  {
    id: 'plugin-server',
    workspace: '@plitzi/e2e',
    command: 'yarn workspace @plitzi/e2e start:plugin',
    origin: `http://127.0.0.1:${String(PORTS.plugin)}`,
    what: 'A plugin as `plitzi create --plugin` writes it, built and published, loaded by a page from its manifest'
  },
  {
    id: 'from-space-server',
    workspace: '@plitzi/e2e',
    command: 'yarn workspace @plitzi/e2e start:from-space',
    origin: `http://127.0.0.1:${String(PORTS.fromSpace)}`,
    what: 'A space taken out of a platform with `plitzi create --from`, served by the project the CLI wrote alone'
  },
  {
    id: 'mail-sink',
    workspace: '@plitzi/e2e',
    command: 'yarn workspace @plitzi/e2e start:mail',
    /** Readiness is this HTTP port; the SMTP side the spaces send to listens on `MAIL_SINK.smtpPort`. */
    origin: `http://127.0.0.1:${String(PORTS.mailSinkHttp)}`,
    what: 'The SMTP server the suite’s spaces send through — keeps every message, delivers none'
  },
  {
    id: 'no-build',
    workspace: '@plitzi/example-render-no-build',
    /** Readiness here is an open socket, so a port somebody else already holds reads as "the server is up" — the
     *  example never starts, and the spec fails against a stranger's empty response with a blank screenshot and
     *  nothing to explain it. The suite's own band (`PORTS`) is what keeps that from happening. */
    command: `PORT=${String(PORTS.renderNoBuild)} yarn workspace @plitzi/example-render-no-build start`,
    origin: `http://127.0.0.1:${String(PORTS.renderNoBuild)}`,
    what: 'A plain HTML file: no bundler, no build step',
    gate: {
      open: () => existsSync(VENDOR_BUNDLE),
      hint: 'run `yarn workspace @plitzi/plitzi-sdk build-vendor:prod` — this example loads the built bundle'
    }
  },
  {
    id: 'render',
    workspace: '@plitzi/example-render-offline',
    command: `yarn workspace @plitzi/example-render-offline start --port ${String(PORTS.renderOffline)}`,
    origin: `http://localhost:${String(PORTS.renderOffline)}`,
    what: 'The same render() call from a bundled app',
    warmUp: true
  },
  {
    id: 'react-component',
    workspace: '@plitzi/example-react-component',
    command: `yarn workspace @plitzi/example-react-component start --port ${String(PORTS.reactComponent)}`,
    origin: `http://localhost:${String(PORTS.reactComponent)}`,
    what: '<PlitziSdk> inside your own React tree',
    warmUp: true
  },
  {
    id: 'server-rendered',
    workspace: '@plitzi/example-ssr-pages',
    command: `PORT=${String(PORTS.ssrPages)} yarn workspace @plitzi/example-ssr-pages start`,
    origin: `http://127.0.0.1:${String(PORTS.ssrPages)}`,
    what: 'The same space, rendered by the server'
  },
  {
    id: 'server-components',
    workspace: '@plitzi/example-ssr-rsc',
    command: `PORT=${String(PORTS.ssrRsc)} yarn workspace @plitzi/example-ssr-rsc start`,
    origin: `http://127.0.0.1:${String(PORTS.ssrRsc)}`,
    what: 'Per-element server data via React Server Components'
  },
  {
    id: 'mcp-server',
    workspace: '@plitzi/example-mcp-server',
    command: `PORT=${String(PORTS.mcpServer)} yarn workspace @plitzi/example-mcp-server start`,
    origin: `http://127.0.0.1:${String(PORTS.mcpServer)}`,
    what: 'A dedicated MCP server an agent edits the space through'
  },
  {
    id: 'ssr-preview',
    workspace: '@plitzi/example-ssr-mcp-preview',
    command: `PORT=${String(PORTS.ssrMcpPreview)} yarn workspace @plitzi/example-ssr-mcp-preview start`,
    origin: `http://127.0.0.1:${String(PORTS.ssrMcpPreview)}`,
    what: 'MCP and pages on one port, plus draft preview'
  },
  {
    id: 'sessions',
    workspace: '@plitzi/example-with-users',
    command: `PORT=${String(PORTS.withUsers)} yarn workspace @plitzi/example-with-users start`,
    origin: `http://127.0.0.1:${String(PORTS.withUsers)}`,
    what: 'Sign in, renew, sign out — over an account store you provide'
  },
  {
    id: 'mysql',
    workspace: '@plitzi/example-with-users-mysql',
    command: `PORT=${String(PORTS.withUsersMysql)} yarn workspace @plitzi/example-with-users-mysql start`,
    origin: `http://127.0.0.1:${String(PORTS.withUsersMysql)}`,
    what: 'The same sessions, over a MySQL account store',
    gate: {
      open: mysqlReachable,
      hint: 'start a MySQL on 127.0.0.1:33006 (the services compose of plitzi-sdk-server has one), or set DATABASE_URL'
    }
  },
  {
    id: 'server-actions-no-server',
    workspace: '@plitzi/example-server-actions-no-server',
    command: `yarn workspace @plitzi/example-server-actions-no-server start --port ${String(PORTS.actionsNoServer)}`,
    /** Vite binds the NAME localhost, which resolves to ::1 first on macOS — see the note on `origin` above. */
    origin: `http://localhost:${String(PORTS.actionsNoServer)}`,
    what: 'The same space in the browser alone: every server-side step inert',
    warmUp: true
  },
  {
    id: 'server-actions-schedules',
    workspace: '@plitzi/example-server-actions-schedules',
    /** A queue file of its own for every run: the example keeps its jobs across restarts, which is the point of it
     *  and exactly wrong for a spec that counts them. */
    command: `PORT=${String(PORTS.schedules)} QUEUE_DB="$(mktemp -d)/queue.db" yarn workspace @plitzi/example-server-actions-schedules start`,
    origin: `http://127.0.0.1:${String(PORTS.schedules)}`,
    what: 'Scheduled and delayed jobs over a durable queue the server keeps in SQLite'
  },
  {
    id: 'runtime',
    workspace: '@plitzi/example-runtime',
    command: `PORT=${String(PORTS.runtime)} PULSE_SECONDS=1 yarn workspace @plitzi/example-runtime start`,
    origin: `http://127.0.0.1:${String(PORTS.runtime)}`,
    what: 'A space runtime self-hosted: its task, its route and its held-open stream, loaded with serveRuntime'
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

      return `PLITZI_BUILDER_HTTP=1 PLITZI_BUILDER_PORT=${String(PORTS.builder)} PLITZI_WEB_KEY=${webKey} PLITZI_USER_KEY=${userKey} yarn workspace @plitzi/plitzi-builder start`;
    },
    /** A live run's space token is bound to the origins it was minted for: `yarn token` mints for this one. */
    origin: BUILDER_ORIGIN,
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
