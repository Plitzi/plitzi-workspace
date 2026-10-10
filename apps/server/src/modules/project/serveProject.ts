import { X509Certificate } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { isIP } from 'node:net';
import { hostname, networkInterfaces } from 'node:os';
import path from 'node:path';

import { assertProjectLayout, layoutFindingText } from '@plitzi/sdk-shared/project/layout';
import { localNetworkName, networkAddresses } from '@plitzi/sdk-shared/project/network';
import {
  DATA_DIR,
  DEV_SERVER_FILE,
  FUNCTIONS_DIR,
  KV_FILE,
  PROJECT_TMP,
  PUBLIC_DIR,
  RUNTIME_BUNDLE,
  RUNTIME_ENTRY
} from '@plitzi/sdk-shared/project/paths';
import { projectModule, projectRoot } from '@plitzi/sdk-shared/project/root';
import { EMPTY_SCHEMA } from '@plitzi/sdk-shared/schema/schemaConstants';
import { EMPTY_STYLE_SCHEMA } from '@plitzi/sdk-shared/style/styleConstants';

import { projectPlugins, watchProjectPlugins } from './plugins';
import { createSpaceFailure } from './spaceFailure';
import { watchSpace } from './watchSpace';
import { createCloudAdapters } from '../../adapters/cloudAdapters';
import { createJsonAdapters } from '../../adapters/jsonAdapters';
import { createServer } from '../../core/createServer';
import { freePort } from '../../core/freePort';
import { closeOnSignals } from '../../core/server/closeOnSignals';
import { isFleetWorker } from '../../core/server/fleet/role';
import { fleetKv } from '../../core/server/fleet/stores';
import { consoleLogger } from '../../helpers/serverLog';
import { credentialsFromEnv } from '../actions/runtime/credentials';
import { createFileKv } from '../actions/runtime/fileKv';
import { loadFunctions } from '../functions/load';
import { loadRuntime, loadRuntimeModule } from '../runtime/bundle';
import { reachOwnServer } from '../runtime/inside';
import { serveRuntime } from '../runtime/stages';

import type { AuthoredDocuments } from './watchSpace';
import type { ServerConfig } from '../../core/createServer';
import type { FileKv } from '../actions/runtime/fileKv';
import type { ActionCredential, ActionLookups } from '../actions/types';
import type { ConnectorManifest } from '../connectors';
import type { ActionEntry, Environment, SSRPageAdapters, SSRServer } from '@plitzi/sdk-shared';

/** What `serveProject` sets itself, from the project's layout — so never the project's options'. */
type SetByProject = 'port' | 'health' | 'adapters' | 'plugins' | 'publicDir' | 'dataDir' | 'functions' | 'action';

/**
 * What a project's server does besides serving its space — its `src/config/serverOptions.ts`: what `createServer`
 * takes, but for what `serveProject` wires from the project's layout, and an action's `lookups`, which are the
 * project's `src/actions/`. `logLevel` and `logger` are the project's to change; `action.kv` too. So are `devMode` and
 * `devReload`, which follow `NODE_ENV` when left out — on unless it is `production`. A deployment started without it (a
 * container's `CMD`, a process manager with no environment) says `devMode: false` here, and a public action answers
 * with its output alone, never the trace of every step.
 */
export type ProjectServerOptions = Partial<Omit<ServerConfig, SetByProject>> & {
  action?: Omit<NonNullable<ServerConfig['action']>, 'lookups'>;
};

/** A space authored in the project — `authorProjectSpace` of `@plitzi/sdk-authoring/node` — and what it warned of. */
export type ProjectSpace = AuthoredDocuments & { warnings?: readonly { message: string }[] };

/**
 * The errors whose message is the whole report — every problem, where it is and what to write instead — and whose
 * stack would only point inside the SDK: the project's root, its layout, a space module with no space, a space that does
 * not author. Told by name, since each package that throws one carries its own copy of the class.
 */
const REPORTS: ReadonlySet<string> = new Set([
  'ProjectRootError',
  'ProjectLayoutError',
  'ProjectSpaceError',
  'SpaceRefusedError'
]);

const isReport = (error: unknown): error is Error => error instanceof Error && REPORTS.has(error.name);

type ServeProjectBase = {
  /** The space's server actions (`src/actions/`), found by their id. Left out, the server runs none. */
  actions?: readonly ActionEntry[];
  /** The connectors those actions call, by id. */
  connectors?: ReadonlyMap<string, ConnectorManifest>;
  /** `src/config/serverOptions.ts`: spread before what `serveProject` wires, which wins where both say something. */
  serverOptions?: ProjectServerOptions;
};

export type ServeProjectOptions = ServeProjectBase &
  (
    | {
        /**
         * The space, held in the project: authored once its layout is checked — `authorProjectSpace` of
         * `@plitzi/sdk-authoring/node` — served from memory, and, while developing, authored again on a save.
         */
        space: () => ProjectSpace | Promise<ProjectSpace>;
        cloud?: never;
      }
    | {
        /**
         * The space stays in Plitzi, read with `PLITZI_HOST_KEY` (and `PLITZI_ENVIRONMENT`, `PLITZI_REVISION`,
         * `PLITZI_SERVER_URL`): `name` is what `/health` answers with — no space document says it here.
         */
        cloud: { name: string };
        space?: never;
      }
  );

/** The project's server, running. */
export type ServedProject = {
  server: SSRServer;
  /** Where this machine reaches it, as `tmp/dev-server.json` records it: `http://127.0.0.1:<port>`, `https` with a certificate. */
  url: string;
  /** Stops watching, closes the server and the runtime — what a signal does, for a caller that stops it itself. */
  close: () => Promise<void>;
};

const ENVIRONMENTS: readonly Environment[] = ['main', 'production', 'staging', 'development'];

const isEnvironment = (value: string): value is Environment => ENVIRONMENTS.some(environment => environment === value);

/** The one space a project's server serves, which is the one it runs the actions on a clock for. */
const SPACE_ID = 1;

/**
 * The space's HOST key — not the public one a published page embeds. They are different credentials on purpose: the
 * public `render` key is readable by anyone who views source, and what keeps a copied one from working is that a
 * browser states the origin it presents from. A server has no such statement to make, so it gets a key whose
 * protection is that it is secret: issued once, never committed, never shipped in a page, revocable on its own.
 */
const cloudAdapters = (pluginNames: string[]): SSRPageAdapters => {
  const webKey = process.env.PLITZI_HOST_KEY ?? '';
  if (!webKey) {
    throw new Error('Set PLITZI_HOST_KEY in .env — Credentials, in the builder.');
  }

  const environment = process.env.PLITZI_ENVIRONMENT ?? 'main';
  if (!isEnvironment(environment)) {
    throw new Error(`PLITZI_ENVIRONMENT is "${environment}": one of ${ENVIRONMENTS.join(', ')}.`);
  }

  // `main` is what the builder is editing, read live; a published environment serves its latest release, and
  // `PLITZI_REVISION` pins one exact version.
  return createCloudAdapters({
    webKey,
    ...(process.env.PLITZI_SERVER_URL ? { serverUrl: process.env.PLITZI_SERVER_URL } : {}),
    environment,
    ...(process.env.PLITZI_REVISION ? { revision: Number(process.env.PLITZI_REVISION) } : {}),
    deployment: { pluginNames }
  });
};

const LOOPBACK = new Set(['127.0.0.1', '::1', 'localhost']);
const ANY_ADDRESS = new Set(['0.0.0.0', '::']);

/** An address as a URL writes it: an IPv6 one in brackets. */
const urlHost = (address: string): string => (address.includes(':') ? `[${address}]` : address);

/** Where this machine reaches a server listening on `host`: its loopback, unless it listens on one address only. */
const localAddress = (host: string): string =>
  host === '::1' ? host : LOOPBACK.has(host) || ANY_ADDRESS.has(host) ? '127.0.0.1' : host;

/** Where another device reaches a server listening on `host`: this machine's own network addresses, when it is open. */
const addressesFor = (host: string): string[] => {
  if (LOOPBACK.has(host)) {
    return [];
  }

  return ANY_ADDRESS.has(host) ? networkAddresses(networkInterfaces()) : [host];
};

type ProjectTls = NonNullable<ProjectServerOptions['tls']>;

/**
 * HTTPS with no code of the project's: `TLS_CERT` and `TLS_KEY` in `.env`, the PEM certificate and its key — what
 * `plitzi cert` makes, for a tablet on the Wi-Fi, whose browser gives a page served over http no microphone, camera,
 * clipboard or service worker. Relative to the project's root.
 */
const tlsFromEnv = (root: string): ProjectTls | undefined => {
  const { TLS_CERT: cert, TLS_KEY: key } = process.env;
  if (!cert && !key) {
    return undefined;
  }

  if (!cert || !key) {
    throw new Error('Set both TLS_CERT and TLS_KEY in .env — the certificate and its key — or neither.');
  }

  const read = (name: string, file: string): Buffer => {
    try {
      return readFileSync(path.resolve(root, file));
    } catch {
      throw new Error(`${name} in .env is "${file}", which cannot be read — \`plitzi cert\` makes the pair.`);
    }
  };

  return { cert: read('TLS_CERT', cert), key: read('TLS_KEY', key) };
};

/**
 * What another device opens this server by, its certificate considered: every network address, and this machine's
 * mDNS name when the certificate names it. The addresses the certificate does not name are said apart — a device that
 * opens one is refused the page, which happens when the router hands this machine a new address.
 */
const reachedBy = (addresses: string[], tls: ProjectTls | undefined): { names: string[]; unnamed: string[] } => {
  if (!tls) {
    return { names: addresses, unnamed: [] };
  }

  const certificate = new X509Certificate(tls.cert);
  const name = localNetworkName(hostname());

  return {
    names: [...addresses, ...(certificate.checkHost(name) ? [name] : [])],
    unnamed: addresses.filter(
      address => (isIP(address) ? certificate.checkIP(address) : certificate.checkHost(address)) === undefined
    )
  };
};

const actionLookups = (
  actions: readonly ActionEntry[],
  connectors: ReadonlyMap<string, ConnectorManifest>,
  credentials: Readonly<Record<string, ActionCredential>>
): ActionLookups => ({
  getAction: (_spaceId, actionId) => Promise.resolve(actions.find(entry => entry.id === actionId)),
  // The project's own: a self-hosted space has no credential store but its environment (`PLITZI_CREDENTIALS`).
  getCredential: (_spaceId, identifier) =>
    Promise.resolve(Object.hasOwn(credentials, identifier) ? credentials[identifier] : undefined),
  listActions: () => Promise.resolve([...actions]),
  getConnector: (_spaceId, connectorId) => Promise.resolve(connectors.get(connectorId)),
  listScheduledSpaces: () => Promise.resolve([SPACE_ID])
});

/**
 * The space this project serves, authored from its own source — or Plitzi's, named for `/health`.
 *
 * While developing, one that does not author is not the end of the server: it comes up saying why (`spaceFailure`),
 * named after the project's folder, and serves the space the first time a save authors. A deployment refuses to start.
 */
const spaceToServe = async (
  { space, cloud }: ServeProjectOptions,
  developing: boolean,
  root: string
): Promise<{ space?: ProjectSpace; failure?: string; name: string }> => {
  if (!space) {
    return { name: cloud.name };
  }

  try {
    const authored = await space();

    return { space: authored, name: authored.schema.definition.permanentUrl };
  } catch (error) {
    if (!developing) {
      throw error;
    }

    // A refusal is the whole report already; anything else is the project's code, and its stack is what finds it.
    const said = isReport(error)
      ? error.message
      : error instanceof Error
        ? (error.stack ?? error.message)
        : String(error);

    return { failure: said, name: path.basename(root) };
  }
};

/** What is served of a space that has not authored yet: nothing — every page answers with why (`spaceFailure`). */
const NOTHING_AUTHORED: AuthoredDocuments = { schema: EMPTY_SCHEMA.schema, style: EMPTY_STYLE_SCHEMA };

const startProject = async (options: ServeProjectOptions): Promise<ServedProject> => {
  const { actions, connectors = new Map<string, ConnectorManifest>(), serverOptions = {} } = options;
  const root = projectRoot();
  const developing = process.env.NODE_ENV !== 'production';
  // Laid out where the server would read nothing — a plugin it cannot build, code in a misnamed folder, `.env` in
  // `src/` — it does not start: every error said at once, never a page short of a part, nor a boot that fails on the first.
  const layout = assertProjectLayout(root, { mode: 'server', space: options.space ? 'local' : 'cloud' });
  // What works and should not stay is said while developing; a deployment's log is not where a project is changed.
  if (developing) {
    for (const warning of layout) {
      console.warn(`[layout] ${layoutFindingText(warning)}`);
    }
  }

  // Loopback unless told otherwise: a container publishes a port only from an address it listens on (`HOST=0.0.0.0`).
  const host = process.env.HOST ?? '127.0.0.1';
  // `PORT` set: that port, and an error if it is taken. Not set, while developing: 8080 or the next free one.
  const port = process.env.PORT ? Number(process.env.PORT) : developing ? await freePort(8080, host) : 8080;
  const tls = serverOptions.tls ?? tlsFromEnv(root);
  // The scheme it answers on: with a certificate it serves HTTPS only, and every address it gives says so.
  const scheme = tls ? 'https' : 'http';
  const localUrl = `${scheme}://${urlHost(localAddress(host))}:${String(port)}`;
  const reached = reachedBy(addressesFor(host), tls);
  const network = reached.names.map(address => `${scheme}://${urlHost(address)}:${String(port)}`);
  /**
   * Where people reach this server: `PUBLIC_URL` behind a proxy; open to the network, the address another device uses
   * — what an OAuth provider sends a tablet back to; this machine's otherwise.
   */
  const publicUrl = (process.env.PUBLIC_URL ?? network.at(0) ?? localUrl).replace(/\/+$/, '');
  // Its own requests to that address — a runtime calling its own MCP — reach it here, whatever certificate it serves.
  if (tls && process.env.PUBLIC_URL === undefined) {
    await reachOwnServer({ publicUrl, listener: { host: localAddress(host), port }, cert: tls.cert });
  }

  const { space, failure, name } = await spaceToServe(options, developing, root);
  const plugins = await projectPlugins(root);
  // What the server serves of a space held in the project: replaced, while developing, by each save authored again.
  const held: { documents?: AuthoredDocuments } | undefined = options.space
    ? { ...(space ? { documents: { schema: space.schema, style: space.style } } : {}) }
    : undefined;
  const spaceFailure = createSpaceFailure();
  if (failure !== undefined) {
    spaceFailure.fail(failure);
    console.error(`[author] ${failure}`);
    console.error('[author] The server is up: fix the space and save, and the page loads it.');
  }
  // Said by the process that was started: in production every worker runs this file too, and would say it again.
  const speaks = !isFleetWorker();
  for (const warning of speaks ? (space?.warnings ?? []) : []) {
    console.warn(`[author] ${warning.message}`);
  }

  const adapters = held
    ? createJsonAdapters({
        offlineData: () => held.documents ?? NOTHING_AUTHORED,
        deployment: { spaceId: SPACE_ID, environment: 'main', revision: 0, pluginNames: plugins.names }
      })
    : cloudAdapters(plugins.names);
  const functionsDir = path.join(root, FUNCTIONS_DIR);
  const functions = existsSync(functionsDir) ? await loadFunctions(functionsDir) : [];

  // The space's runtime, run here: its tasks join the functions, and its endpoints answer before anything else. Its
  // variables are this process's environment. One that came across built only runs as it was built.
  const runtimeBundle = path.join(root, RUNTIME_BUNDLE);
  const spaceRuntime =
    (await loadRuntimeModule(projectModule(root, RUNTIME_ENTRY, process.argv[1]))) ??
    (existsSync(runtimeBundle)
      ? await loadRuntime(readFileSync(runtimeBundle), path.join(root, PROJECT_TMP, 'runtime'))
      : undefined);
  const runtime = spaceRuntime && (await serveRuntime(spaceRuntime, { env: process.env, publicUrl }));

  // What the actions and functions keep, in one file this process holds — a second server of the project is refused,
  // naming this one, rather than both writing over each other's changes. A worker reaches it through the primary.
  let keptKv: FileKv | undefined;
  const kv = fleetKv(() => {
    keptKv = createFileKv({
      file: path.join(root, KV_FILE),
      owner: `the server of "${name}", on port ${String(port)}`
    });

    return keptKv;
  });

  // `name` is what `/health` answers with, and `tmp/dev-server.json` records: how a tool knows it reached THIS project.
  const server = createServer(
    {
      // What went wrong and nothing else: `npm start -- --verbose` adds a line for every request.
      logLevel: process.argv.includes('--verbose') ? 'info' : 'warn',
      logger: consoleLogger,
      ...serverOptions,
      ...(tls ? { tls } : {}),
      port,
      devMode: serverOptions.devMode ?? developing,
      devReload: serverOptions.devReload ?? serverOptions.devMode ?? developing,
      health: { name },
      adapters,
      plugins: plugins.sources,
      publicDir: path.join(root, PUBLIC_DIR),
      dataDir: path.join(root, DATA_DIR),
      functions: { native: [...functions, ...(runtime?.native ?? [])], plugins: plugins.functions },
      // What `ctx.sign` and `ctx.verify` sign with: `PLITZI_SIGNING_SECRET`. What the actions and functions keep in
      // `kv` outlives a restart; a deployment with several processes names its own store (`action.kv`).
      action: {
        signingSecret: process.env.PLITZI_SIGNING_SECRET,
        kv,
        ...serverOptions.action,
        ...(actions ? { lookups: actionLookups(actions, connectors, credentialsFromEnv()) } : {})
      }
    },
    { preAuth: [spaceFailure.stage, ...(runtime ? [runtime.stage] : [])] }
  );

  // Said once the port answers: a tool that waits for "pages on" — or reads `tmp/dev-server.json` — asks right away.
  await server.listen(port, host);
  if (speaks) {
    mkdirSync(path.join(root, PROJECT_TMP), { recursive: true });
    writeFileSync(
      path.join(root, DEV_SERVER_FILE),
      `${JSON.stringify({ name, port, url: localUrl, network, publicUrl }, null, 2)}\n`
    );
    console.log(`pages on ${localUrl}/`);
    // Open past this machine — a tablet on the same Wi-Fi: where to point it, and that anyone on that network can too.
    if (network.length > 0) {
      console.log(
        `also on ${network.map(address => `${address}/`).join(', ')} — anyone on this network can open it (HOST=${host})`
      );
    } else if (developing && LOOPBACK.has(host)) {
      console.log('only this machine opens it: HOST=0.0.0.0 in .env opens it to your network (a phone on the Wi-Fi)');
    }

    if (reached.unnamed.length > 0) {
      console.warn(
        `[tls] the certificate does not name ${reached.unnamed.join(', ')}: a device that opens it there is refused — \`plitzi cert\` makes one for this machine as it is now`
      );
    }
  }

  const watching = developing
    ? [
        ...(held
          ? [
              watchSpace(root, authored => {
                held.documents = authored;
                spaceFailure.clear();
                server.reloadPages();
              })
            ]
          : []),
        watchProjectPlugins(root, server, plugins)
      ]
    : [];
  const close = async (): Promise<void> => {
    watching.forEach(stop => stop());
    await server.close();
    await runtime?.close();
    await keptKv?.close();
  };
  // A deploy, a restart or ^C closes the server instead of dropping it: requests in flight are answered, and the jobs
  // it runs finish first. A second ^C exits at once.
  const stopListening = closeOnSignals({ close });

  return {
    server,
    url: localUrl,
    close: async () => {
      stopListening();
      await close();
    }
  };
};

/**
 * The server of a project `@plitzi/cli` writes — its `src/main.ts` hands it the space, its actions and its options,
 * and everything else comes from where the project keeps it. The project is the working directory, where its scripts
 * start it (`projectRoot`: refused, saying what is missing, anywhere else), laid out where the server reads each part
 * (`assertProjectLayout`: refused with every error at once; its warnings said while developing), and only then is its
 * space authored. A refusal of any of the three is printed as it is — the message is the whole report, every problem
 * and its fix, and a stack would only point inside the SDK — and the process exits with 1. What it serves:
 *
 * - the port: `PORT`, or 8080 — the next free one from there while developing; `HOST`, loopback by default; HTTPS
 *   with `TLS_CERT` and `TLS_KEY` (`plitzi cert`), unless the project's options give `tls` themselves;
 * - its plugins: every folder of `src/plugins` built from its source and server-rendered, every one of `vendor/plugins`
 *   as it was built, each with its server half;
 * - its code: `src/functions/`, and the space's runtime (`src/runtime/` — compiled under `dist/` when the server runs
 *   compiled, `projectModule` — or `vendor/runtime.bundle`) in this process;
 * - `public/` served as it is, `src/data/` read and never served, `kv` kept in `state/kv.json`;
 * - `/health` answering with the space's permanent URL (or the cloud project's name), and the port it took written to
 *   `tmp/dev-server.json` for `check`, `shot` and `visual` to find;
 * - a signal closes it, finishing what runs.
 *
 * While developing (`NODE_ENV` other than `production`), a save to the space is authored again by the project's
 * `plitzi/author.ts`, in a process of its own, which hands the documents back over IPC: the server swaps them in memory
 * and every open page loads again. A plugin folder added is registered, one removed turned off, and a plugin's
 * `functions/` loaded again; a folder it cannot build is said in the terminal, and the server goes on.
 */
export const serveProject = async (options: ServeProjectOptions): Promise<ServedProject> => {
  try {
    return await startProject(options);
  } catch (error) {
    if (!isReport(error)) {
      throw error;
    }

    console.error(error.message);
    process.exitCode = 1;
    process.exit(1);
  }
};
