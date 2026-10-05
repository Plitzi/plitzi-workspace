import { DATA_DIR, DEV_SERVER_FILE, DEV_SPACE_FILE, FUNCTIONS_DIR, KV_FILE, PROJECT_TMP } from './paths';

import type { CreateAnswers, ProjectFiles } from './types';

/**
 * The server-mode entry point: a page server of this project's own.
 *
 * Where the space comes from is one argument — the adapters — and nothing else in the file changes with it. That
 * is the whole shape of `@plitzi/sdk-server`, and the generated project shows it rather than describing it.
 */

/** Written into both entry points, because how a plugin is registered does not change with where the space lives. */
export const PLUGINS = `/**
 * The project's own components: every folder of \`src/plugins\` is one, registered under its name in camelCase —
 * \`src/plugins/StatCard\` is what a space's \`custom({ renderType: 'statCard' })\` renders. \`plitzi add plugin\` writes
 * a new one there, registered at the next start — or at once while developing (\`watchPlugins\` below).
 *
 * \`action: 'compile'\` is what makes them SERVER-rendered. The server builds the entry with esbuild, keeps React
 * external so the plugin runs on the one copy this page already has, serves the bundle to the browser AND imports
 * it into the render — so the component's markup is in the HTML before any JavaScript arrives. See
 * \`src/plugins/README.md\`.
 */
// From the project root, so the path holds whether this file runs as \`src/main.ts\` or compiled as \`dist/main.js\`.
const PROJECT_ROOT = path.resolve(import.meta.dirname, '..');
const PLUGINS_DIR = path.join(PROJECT_ROOT, 'src/plugins');

const pluginName = (folder: string): string => \`\${folder.charAt(0).toLowerCase()}\${folder.slice(1)}\`;
const pluginSource = (folder: string) => ({
  js: path.join(PLUGINS_DIR, folder, 'index.ts'),
  action: 'compile' as const,
  version: '1.0.0'
});
const plugins = Object.fromEntries(
  readdirSync(PLUGINS_DIR, { withFileTypes: true })
    .filter(entry => entry.isDirectory())
    .map(entry => [pluginName(entry.name), pluginSource(entry.name)])
);

/**
 * Registering a plugin is not the same as turning it on.
 *
 * The map above says a plugin EXISTS and how to build it; the deployment says which ones this space renders with,
 * because a server can host many spaces and not all of them want the same components built and shipped. Nothing
 * hands the server that list on its own — leave it out and the page renders "Custom Component … Not Found" with
 * no error anywhere, which is a long afternoon.
 */
const pluginNames = Object.keys(plugins);

/**
 * A plugin's server half: its \`functions/\` folder (\`src/plugins/Board/functions/index.ts\`), written like the
 * project's own \`src/functions/\` and loaded with what a plugin may reach — its own corner of \`kv\`, its routes under
 * \`/fn/plugins/<name>/\` (\`usePluginRoute\` in the component), its tasks named \`<name>.<action>\`. A folder without
 * one is a component and nothing else.
 */
const pluginFunctionsOf = async (folder: string): Promise<FunctionsDefinition | undefined> => {
  const dir = path.join(PLUGINS_DIR, folder, 'functions');

  return existsSync(path.join(dir, 'index.ts')) ? (await loadFunctions(dir))[0] : undefined;
};
const pluginFunctions: Record<string, FunctionsDefinition> = {};
for (const entry of readdirSync(PLUGINS_DIR, { withFileTypes: true })) {
  const definition = entry.isDirectory() ? await pluginFunctionsOf(entry.name) : undefined;
  if (definition) {
    pluginFunctions[pluginName(entry.name)] = definition;
  }
}`;

/**
 * A plugin ADDED while developing — a new folder in \`src/plugins\`, what \`plitzi add plugin\` writes — registered
 * without restarting, and the pages load again to render it. One EDITED is the server's own business (\`devReload\`);
 * its server half (\`functions/\`) is loaded again here.
 */
export const WATCH_PLUGINS = `/**
 * A plugin edited while developing is built again by the server, and the open pages swap it where it is drawn — the
 * rest of the page, its state included, stays as it was. Its server half (\`functions/\`) is loaded again here, in
 * place. A plugin ADDED (a new folder with an \`index.ts\`, what \`plitzi add plugin\` writes) is registered here, and
 * the pages load again to render it; one removed is turned off.
 */
const watchPlugins = (): void => {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const reloading = new Map<string, ReturnType<typeof setTimeout>>();
  const reloadFunctions = (folder: string): void => {
    const name = pluginName(folder);
    pluginFunctionsOf(folder)
      .then(definition => {
        server.functions.setPlugin(name, definition);
        console.log(\`[plugins] \${name}: its functions, loaded again\`);
      })
      .catch((error: unknown) => {
        console.error(\`[plugins] \${name}: its functions were not loaded again:\`, error instanceof Error ? error.message : error);
      });
  };
  // The plugins that are folders of \`src/plugins\`: the only ones a folder coming or going turns on or off.
  const fromFolders = new Set(Object.keys(plugins));
  const sync = (): void => {
    // Name → folder, for every folder that is a plugin now.
    const present = new Map<string, string>();
    for (const entry of readdirSync(PLUGINS_DIR, { withFileTypes: true })) {
      if (entry.isDirectory() && existsSync(path.join(PLUGINS_DIR, entry.name, 'index.ts'))) {
        present.set(pluginName(entry.name), entry.name);
      }
    }

    const added = [...present].filter(([name]) => !fromFolders.has(name));
    const removed = [...fromFolders].filter(name => !present.has(name));
    added.forEach(([name, folder]) => {
      server.plugins.register(name, pluginSource(folder));
      fromFolders.add(name);
      pluginNames.push(name);
      reloadFunctions(folder);
    });
    removed.forEach(name => {
      fromFolders.delete(name);
      pluginNames.splice(pluginNames.indexOf(name), 1);
      server.functions.setPlugin(name, undefined);
    });
    if (added.length > 0 || removed.length > 0) {
      server.reloadPages();
    }
  };

  watch(PLUGINS_DIR, { recursive: true }, (_event, file) => {
    // \`Board/functions/index.ts\`: a plugin's server half changed, and is loaded again on its own.
    const [folder, part] = (file ?? '').split(path.sep);
    if (folder && part === 'functions' && fromFolders.has(pluginName(folder))) {
      clearTimeout(reloading.get(folder));
      reloading.set(folder, setTimeout(() => reloadFunctions(folder), 200));

      return;
    }

    clearTimeout(timer);
    timer = setTimeout(sync, 300);
  });
};

if (DEVELOPING) {
  watchPlugins();
}`;

/**
 * Which port the server takes. `PORT` set: that one, and a clear error if something else has it. Not set, while
 * developing: 8080, or the next free one — so a second project, or anything else on 8080, does not stop this one.
 */
const PORT_SNIPPET = `// Loopback unless told otherwise: a container publishes a port only from an address it listens on (\`HOST=0.0.0.0\`).
const HOST = process.env.HOST ?? '127.0.0.1';
// \`PORT\` set: that port. Not set, while developing: 8080 or the next free one, written down below for the scripts.
const PORT = process.env.PORT
  ? Number(process.env.PORT)
  : process.env.NODE_ENV === 'production'
    ? 8080
    : await freePort(8080, HOST);`;

/** Where the server says it is: the port it took, for `npm run shot` and the visual tests to find. */
const LISTEN_SNIPPET = `server.listen(PORT, HOST);
mkdirSync(path.join(PROJECT_ROOT, '${PROJECT_TMP}'), { recursive: true });
writeFileSync(
  path.join(PROJECT_ROOT, '${DEV_SERVER_FILE}'),
  \`\${JSON.stringify({ name: SERVER_NAME, port: PORT, url: \`http://127.0.0.1:\${PORT}\` }, null, 2)}\\n\`
);
console.log(\`pages on http://127.0.0.1:\${PORT}/\`);`;

/**
 * What a project made from a space runs besides what `create` writes (`plitzi create --from`): the space's runtime, the
 * plugins only a build of came across, and the visitors it signed in on Plitzi.
 */
export type SpaceExtras = {
  /** The runtime's module, from `src/main.ts`, when its source came across. */
  runtimeEntry?: string;
  /** Its packed build, when only that did. */
  packedRuntime: boolean;
  /** Whether some plugin came across built only, in `vendor/plugins/`. */
  builtPlugins: boolean;
  /** The roles the space declares for its visitors. */
  visitorRoles: readonly string[];
};

export type ServerMainOptions = {
  source: CreateAnswers['source'];
  /** What `/health` answers with for a space read from Plitzi; a local one is named by its own permanent URL. */
  name: string;
  /** A project made from a space: what it brought besides. */
  fromSpace?: SpaceExtras;
};

/** One import line, broken over lines the way Prettier would once it is longer than the project's 120 columns. */
const namedImport = (names: readonly string[], from: string, type = false): string => {
  const keyword = type ? 'import type' : 'import';
  const line = `${keyword} { ${names.join(', ')} } from '${from}';`;

  return line.length <= 120 ? line : `${keyword} {\n  ${names.join(',\n  ')}\n} from '${from}';`;
};

/**
 * The project's settings, in `.env` and out of git — what its actions sign with, a cloud project's key, the variables a
 * space was given on Plitzi — read by the process itself, so `start`, `start:dev` and `start:prod` find them alike, and
 * a deployment that sets them in its environment needs no file.
 */
const loadEnv = (cloud: boolean): string => `/**
 * The project's settings — what its actions sign with${cloud ? ', the space key' : ''} — kept in \`.env\`, out of git. A
 * deployment that sets them in its environment needs no file.
 */
try {
  process.loadEnvFile(new URL('../.env', import.meta.url));
} catch {
  // None: the environment the process was started with is all there is.
}`;

const BUILT_PLUGINS = `
/**
 * The space's plugins no source of was kept, as they were built: \`vendor/plugins/<type>/\`, each beside the manifest it
 * was published with. They run and render as they are — on the server too — and cannot be changed here: upload one
 * again from its source (\`plitzi upload plugin\`), and \`plitzi pull\` brings its code in their place.
 */
type BuiltManifest = {
  version?: string;
  functions?: string;
  pluginSchema?: Record<string, unknown>;
  assets?: Record<string, { src: string; type: string; isMain?: boolean }>;
};

const VENDOR_PLUGINS_DIR = path.join(PROJECT_ROOT, 'vendor/plugins');
const built = readdirSync(VENDOR_PLUGINS_DIR, { withFileTypes: true })
  .filter(entry => entry.isDirectory())
  .map(entry => {
    const dir = path.join(VENDOR_PLUGINS_DIR, entry.name);
    // What \`plitzi pack plugin\` wrote beside the bundle when it was published.
    const manifest = JSON.parse(readFileSync(path.join(dir, 'plugin-manifest.json'), 'utf-8')) as BuiltManifest;
    const assets = Object.values(manifest.assets ?? {});
    const script = assets.find(asset => asset.type === 'script' && asset.isMain) ?? assets.find(asset => asset.type === 'script');
    const style = assets.find(asset => asset.type === 'style');
    if (!script) {
      throw new Error(\`vendor/plugins/\${entry.name}/plugin-manifest.json names no script to run.\`);
    }

    return {
      type: entry.name,
      provides: Object.keys(manifest.pluginSchema ?? {}),
      source: {
        js: path.join(dir, script.src),
        ...(style ? { css: path.join(dir, style.src) } : {}),
        action: 'copy' as const,
        version: manifest.version ?? '1.0.0'
      },
      // Its server half, as it was packed: the source, built and loaded here like a folder's.
      ...(manifest.functions ? { functions: path.join(dir, manifest.functions) } : {})
    };
  });
const builtPlugins = Object.fromEntries(built.map(({ type, source }) => [type, source]));
/** Every element type they provide, for the space's use of them to be authored as a plugin's rather than a typo's. */
const builtTypes = built.flatMap(({ type, provides }) => [type, ...provides]);
`;

/** The built plugins' names and server halves, beside the folders': the lists a folder coming or going changes. */
const BUILT_FUNCTIONS = `
pluginNames.push(...Object.keys(builtPlugins));
for (const { type, functions: carried } of built) {
  if (carried) {
    const [definition] = await loadFunctionsSource(JSON.parse(readFileSync(carried, 'utf-8')) as Record<string, string>);
    if (definition) {
      pluginFunctions[type] = definition;
    }
  }
}`;

const runtimeLines = ({ runtimeEntry, packedRuntime }: SpaceExtras): string => {
  if (runtimeEntry) {
    return `/**
 * The space's runtime — its own server code, run by Plitzi beside the space — run here, in this process: its tasks join
 * the functions, and its endpoints answer before anything else. Its variables are this process's environment.
 */
const runtime = await serveRuntime(spaceRuntime, { env: process.env, publicUrl });`;
  }

  if (packedRuntime) {
    return `/**
 * The space's runtime, as it was built: no source of it was kept, so it runs as it is and cannot be changed here. Push
 * it again from its source (\`plitzi runtime push\`), and \`plitzi pull\` brings its code in its place.
 */
const runtime = await serveRuntime(
  await loadRuntime(readFileSync(path.join(PROJECT_ROOT, 'vendor/runtime.bundle')), path.join(PROJECT_ROOT, '.runtime')),
  { env: process.env, publicUrl }
);`;
  }

  return '';
};

/** What a space with visitor roles needs of a server of its own, said where its auth would be handed over. */
const visitorsNote = (roles: readonly string[]): string => `
/**
 * The space declares visitor roles (${roles.join(', ')}). On Plitzi its visitors sign in with their Plitzi account, and
 * hold the roles the space gives them by email. Here nobody signs in until this server does it itself: \`createAuth\`
 * from \`@plitzi/sdk-server/auth\`, handed to \`createServer\` as \`auth\`, over the accounts it keeps — giving each
 * person the permissions of the roles they hold (\`visitorAccess\` from \`@plitzi/sdk-shared/auth/visitorRoles\`, over
 * the space's \`settings.visitorRoles\`). Until then every action that asks for a role refuses. See Self-hosting, in
 * Plitzi's docs.
 */
`;

const LOCAL_AUTHORING = (builtPlugins: boolean): string => `/**
 * The space, held in this project.
 *
 * \`authorSpace\` turns the declaration in \`src/space.ts\` into the two documents a renderer wants, at boot — and its
 * warnings are printed here, where somebody editing the space is watching.
 */
// \`declarations\`: what the project's plugins fire, answer and read, so the space's use of them is checked too.
// \`serverData\` and \`data\`: the files a provider reads — the project's own and \`public/\` — so a binding onto a path
// one of them does not have is warned.
const { schema, style, warnings } = authorSpace(space, {
  plugins: declarations,${builtPlugins ? '\n  pluginTypes: builtTypes,' : ''}
  serverData: projectData(path.join(PROJECT_ROOT, '${DATA_DIR}')),
  data: publicData(path.join(PROJECT_ROOT, 'public'))
});
const offlineData = { schema, style };

for (const warning of warnings) {
  console.warn(\`[author] \${warning.message}\`);
}`;

const CLOUD_KEY = `/**
 * The space's HOST key — not the public one a published page embeds.
 *
 * They are different credentials on purpose. The public \`render\` key is readable by anyone who views source on
 * the published site, and what keeps a copied one from working is that a browser is made to state the origin it
 * is presenting from. A server has no such statement to make, so it gets a key whose protection is that it is
 * secret: issued once, never committed, never shipped in a page, and revocable on its own.
 */
const HOST_KEY = process.env.PLITZI_HOST_KEY ?? '';

if (!HOST_KEY) {
  throw new Error('Set PLITZI_HOST_KEY in .env — Credentials, in the builder.');
}`;

const DEV_SPACE = `/**
 * While developing, the documents are served from \`${DEV_SPACE_FILE}\`, which the server reads again whenever it changes —
 * so a save is re-authored into it and shown without restarting anything (see \`watchSpace\` below). A by-product, in
 * \`tmp/\` with everything else the project writes for itself: the space is \`src/space.ts\`. A deployment keeps the
 * documents in memory, as authored at boot.
 */
const OFFLINE_DATA = path.join(PROJECT_ROOT, '${DEV_SPACE_FILE}');
if (DEVELOPING) {
  mkdirSync(path.dirname(OFFLINE_DATA), { recursive: true });
  writeFileSync(OFFLINE_DATA, \`\${JSON.stringify(offlineData, null, 2)}\\n\`);
}`;

const FUNCTIONS = `/**
 * This project's own server code: \`${FUNCTIONS_DIR}/\` — what \`plitzi functions pull\` writes and \`push\` sends —
 * built the way Plitzi builds a space's and run here, in this process, from its source (as \`start:prod\` does too).
 * Nothing there, no functions; code that does not build stops the server with the file and line.
 */
const functions = await loadFunctions(path.join(PROJECT_ROOT, '${FUNCTIONS_DIR}'));`;

/** The space's actions found by their id — and, for a space that came with them, its connectors. */
const ACTION_LOOKUPS = (connectors: boolean): string => `/**
 * The space's server actions — \`src/actions.ts\` — found by their id${connectors ? ', with its connectors' : ''}; and the one
 * space this server serves, which is the one it runs the actions on a clock for.
 */
const SPACE_ID = 1;
const actionLookups: ActionLookups = {
  getAction: (_spaceId, actionId) => Promise.resolve(actions.find(entry => entry.id === actionId)),
  listActions: () => Promise.resolve(actions),${connectors ? '\n  getConnector: (_spaceId, connectorId) => Promise.resolve(connectors.get(connectorId)),' : ''}
  listScheduledSpaces: () => Promise.resolve([SPACE_ID])
};`;

const LOCAL_ADAPTERS = `/**
 * Where the server gets a space from, and the only line that knows.
 *
 * \`createJsonAdapters\` is the file-backed shortcut: hand it a \`{ schema, style }\` and it answers every read a
 * page server makes. A real deployment swaps this for adapters onto its own database, or for
 * \`createCloudAdapters\` to read the live space out of Plitzi — the server never learns the difference.
 */`;

const CLOUD_ADAPTERS = `/**
 * The space stays in Plitzi; the SERVER is this one.
 *
 * The live document is read over the same query the browser-rendered SDK uses, so the space keeps being edited,
 * published and versioned in the builder while every request is served from here — under this deployment's own
 * domain, auth, actions and logs.
 *
 * \`environment\` is the decision worth being deliberate about: \`main\` is what the builder is editing, read live
 * on every request; a published environment with no \`revision\` serves the latest and releases itself; with a
 * \`revision\` it serves exactly that version, for a deployment that rolls forward on its own schedule.
 */`;

const CLOSE = (runtime: boolean): string => `/**
 * A deploy, a restart or ^C closes the server instead of dropping it: requests in flight are answered, and once the
 * space runs scheduled actions, the jobs this server is running finish first — what is still waiting stays in the
 * queue for whichever server runs next. A second ^C exits at once.
 */
closeOnSignals(server${runtime ? ', { afterClose: () => runtime.close() }' : ''});`;

const WATCH_SPACE = `/**
 * A save to the space, while developing: re-authored by \`src/author.ts\` in a process of its own — the only way to
 * read every file of it again, which an import never does twice — and every open page loads again once it wrote the
 * new documents. What it refuses is printed and the page keeps the last space that authored. A change to the server's
 * own code — this file, the server options, the actions, its functions — restarts the server instead (\`start:dev\` watches those),
 * and a plugin's component is swapped in the open pages by the server (\`watchPlugins\` below): only its declaration
 * is the space's business.
 */
const RESTARTS = ['main.ts', 'serverOptions.ts', 'actions.ts'];
const authored = (file: string): boolean =>
  !RESTARTS.includes(file) &&
  !/^(actions|connectors|functions)[\\\\/]/.test(file) &&
  (!file.startsWith(\`plugins\${path.sep}\`) || ['declaration.ts', 'declarations.ts'].includes(path.basename(file)));
const watchSpace = (): void => {
  let timer: ReturnType<typeof setTimeout> | undefined;
  let authoring = false;
  let again = false;
  const author = (): void => {
    if (authoring) {
      again = true;

      return;
    }

    authoring = true;
    const child = spawn(process.execPath, [path.join(PROJECT_ROOT, 'src/author.ts'), '--out', OFFLINE_DATA], {
      cwd: PROJECT_ROOT,
      stdio: 'inherit'
    });
    child.on('close', code => {
      authoring = false;
      if (code === 0) {
        server.reloadPages();
      }

      if (again) {
        again = false;
        author();
      }
    });
  };

  watch(path.join(PROJECT_ROOT, 'src'), { recursive: true }, (_event, file) => {
    if (!file || !authored(file)) {
      return;
    }

    clearTimeout(timer);
    timer = setTimeout(author, 100);
  });
};

if (DEVELOPING) {
  watchSpace();
}`;

/** \`createServer(config)\`, or with a runtime \`createServer(config, { preAuth })\` — laid out as Prettier lays them out. */
const createServerCall = (config: string, runtime: boolean): string =>
  runtime
    ? `createServer(\n  ${config.replace(/\n/g, '\n  ')},\n  { preAuth: [runtime.stage] }\n)`
    : `createServer(${config})`;

/**
 * The server-mode `src/main.ts`, for a project of its own and for one made from a space alike: the same server, port,
 * health, reloads and settings — a space made into a project brings what it had besides (`SpaceExtras`), never a
 * server of another shape.
 */
export const serverMain = ({ source, name, fromSpace }: ServerMainOptions): string => {
  const local = source === 'local';
  const runtime = Boolean(fromSpace?.runtimeEntry) || Boolean(fromSpace?.packedRuntime);
  const built = Boolean(fromSpace?.builtPlugins);
  // A local space's actions are the project's; a cloud space's run on Plitzi — unless they came across with it.
  const actions = local || fromSpace !== undefined;
  const fsNames = [
    'existsSync',
    'mkdirSync',
    'readdirSync',
    ...(built || fromSpace?.packedRuntime ? ['readFileSync'] : []),
    'watch',
    'writeFileSync'
  ];
  const serverNames = [
    'closeOnSignals',
    'consoleLogger',
    local ? 'createJsonAdapters' : 'createCloudAdapters',
    'createServer',
    'freePort',
    'loadFunctions',
    ...(built ? ['loadFunctionsSource'] : [])
  ];
  const runtimeNames = [...(fromSpace?.packedRuntime ? ['loadRuntime'] : []), ...(runtime ? ['serveRuntime'] : [])];
  const ownImports = [
    ...(actions ? [namedImport(fromSpace ? ['actions', 'connectors'] : ['actions'], './actions.ts')] : []),
    ...(local ? [namedImport(['declarations'], './plugins/declarations.ts')] : []),
    ...(fromSpace?.runtimeEntry ? [`import spaceRuntime from '${fromSpace.runtimeEntry}';`] : []),
    namedImport(['serverOptions'], './serverOptions.ts'),
    ...(local ? [namedImport(['space'], './space.ts')] : [])
  ];
  const plugins = built ? '{ ...plugins, ...builtPlugins }' : 'plugins';
  const native = runtime ? '[...functions, ...runtime.native]' : 'functions';
  const adapters = local
    ? `createJsonAdapters({
    offlineData: DEVELOPING ? OFFLINE_DATA : offlineData,
    deployment: { spaceId: SPACE_ID, environment: 'main', revision: 0, pluginNames }
  })`
    : `createCloudAdapters({
    webKey: HOST_KEY,
    ...(process.env.PLITZI_SERVER_URL ? { serverUrl: process.env.PLITZI_SERVER_URL } : {}),
    environment: (process.env.PLITZI_ENVIRONMENT ?? 'main') as 'main' | 'production',
    ...(process.env.PLITZI_REVISION ? { revision: Number(process.env.PLITZI_REVISION) } : {}),
    deployment: { pluginNames }
  })`;

  const serverConfig = `{
  // What went wrong and nothing else: \`npm start -- --verbose\` adds a line for every request.
  logLevel: process.argv.includes('--verbose') ? 'info' : 'warn',
  logger: consoleLogger,
  // What the server does besides serving the space — \`src/serverOptions.ts\`, the project's own. What follows is this
  // file's, and comes after it: the space, its plugins, its files and its code are wired here.
  ...serverOptions,
  port: PORT,
  devMode: DEVELOPING,
  // ${local ? 'A save to the space re-authors it and the open pages load again (`watchSpace` below); a' : 'A'} plugin built again is swapped in them (\`watchPlugins\` below).
  devReload: DEVELOPING,
  health: { name: SERVER_NAME },
  adapters: ${adapters},
  plugins: ${plugins},
  // \`public/\` served as it is, to anyone: images, a favicon.
  publicDir: path.join(PROJECT_ROOT, 'public'),
  // The project's own data, never served: a provider resolved on the server asks for \`/data/<file>\`.
  dataDir: path.join(PROJECT_ROOT, '${DATA_DIR}'),
  functions: { native: ${native}, plugins: pluginFunctions },
  // What \`ctx.sign\` and \`ctx.verify\` sign with: \`PLITZI_SIGNING_SECRET\`, in \`.env\`. What the actions and functions
  // keep in \`kv\` is in \`${KV_FILE}\`, outliving a restart; a deployment with several processes, or a database, names
  // its own store in \`src/serverOptions.ts\` (\`action.kv\`).
  action: {
    signingSecret: process.env.PLITZI_SIGNING_SECRET,
    kv: createFileKv({ file: path.join(PROJECT_ROOT, '${KV_FILE}') }),
    ...serverOptions.action${actions ? ',\n    lookups: actionLookups' : ''}
  }
}`;

  return `${local ? `${namedImport(['spawn'], 'node:child_process')}\n` : ''}${namedImport(fsNames, 'node:fs')}
import path from 'node:path';

${namedImport(serverNames, '@plitzi/sdk-server')}
import { createFileKv } from '@plitzi/sdk-server/actions';
${runtime ? `${namedImport(runtimeNames, '@plitzi/sdk-server/runtime')}\n` : ''}${local ? `\n${namedImport(['authorSpace'], '@plitzi/sdk-authoring')}\n${namedImport(['projectData', 'publicData'], '@plitzi/sdk-authoring/node')}\n` : ''}
${ownImports.join('\n')}

${actions ? `${namedImport(['ActionLookups'], '@plitzi/sdk-server/actions', true)}\n` : ''}${namedImport(['FunctionsDefinition'], '@plitzi/sdk-server/functions', true)}

${loadEnv(!local)}

${PORT_SNIPPET}
${
  runtime
    ? `/** Where people reach this server: \`PUBLIC_URL\` behind a proxy, its own address otherwise. */
const publicUrl = (process.env.PUBLIC_URL ?? \`http://127.0.0.1:\${String(PORT)}\`).replace(/\\/+$/, '');
`
    : ''
}
${PLUGINS}
${built ? BUILT_PLUGINS : ''}${built ? BUILT_FUNCTIONS : ''}

const DEVELOPING = process.env.NODE_ENV !== 'production';

${local ? LOCAL_AUTHORING(built) : CLOUD_KEY}
${local ? `\n${DEV_SPACE}\n` : ''}
${FUNCTIONS}
${runtime && fromSpace ? `\n${runtimeLines(fromSpace)}\n` : ''}${fromSpace && fromSpace.visitorRoles.length > 0 ? visitorsNote(fromSpace.visitorRoles) : ''}${actions ? `\n${ACTION_LOOKUPS(Boolean(fromSpace))}\n` : ''}
${local ? LOCAL_ADAPTERS : CLOUD_ADAPTERS}
// What \`/health\` answers with, and \`${DEV_SERVER_FILE}\` records: how a tool knows it reached THIS project.
const SERVER_NAME = ${local ? 'schema.definition.permanentUrl' : JSON.stringify(name)};
const server = ${createServerCall(serverConfig, runtime)};

${LISTEN_SNIPPET}

${CLOSE(runtime)}
${local ? `\n${WATCH_SPACE}\n` : ''}
${WATCH_PLUGINS}
`;
};

/**
 * What the project's server does besides serving the space, in a file of the project's own: `src/main.ts` is the CLI's
 * — `plitzi upgrade` keeps it current — and a server that needed its images, its actions' limits or its `kv` had to edit
 * it, and port the edit by hand at every upgrade.
 */
/** What a local project's server options say about its actions — the server runs them itself. */
const ACTION_OPTIONS_DOC = ` * - \`action: { limits: { maxRequests, timeoutMs } }\` — a server action reading many sources: 20 requests and 10 s a
 *   run by default. \`action.kv\` — where \`kv\` keeps what it writes: \`${KV_FILE}\` by default.
`;

const serverOptionsModule = (local: boolean): string => `import type { ServerConfig } from '@plitzi/sdk-server';

/** What \`src/main.ts\` sets itself — where the space comes from, its plugins, its files, its code — so not this file's. */
type SetByMain =
  | 'port'
  | 'devMode'
  | 'devReload'
  | 'health'
  | 'adapters'
  | 'plugins'
  | 'publicDir'
  | 'dataDir'
  | 'functions'
  | 'action';

/** What \`createServer\` takes but for what \`src/main.ts\` sets — and an action's \`lookups\`: \`src/actions.ts\`. */
type ServerOptions = Partial<Omit<ServerConfig, SetByMain>> & {
  action?: Omit<NonNullable<ServerConfig['action']>, 'lookups'>;
};

/**
 * What this project's server does besides serving the space — yours. \`src/main.ts\` is the CLI's (\`plitzi upgrade\`
 * keeps it current) and hands these to \`createServer\`; what it sets itself is not offered here, and wins if written.
 * The ones a project reaches for:
 *
 * - \`images: { domains: ['images.example.com'] }\` — pictures from those hosts resized here, with \`sharp\` installed.
${local ? ACTION_OPTIONS_DOC : ''} * - \`rsc: { elementTimeoutMs }\` — how long a section resolved on the server is waited for: 5 s by default.
 */
export const serverOptions: ServerOptions = {};
`;

/** The space's server actions, in a file of the project's own that `src/main.ts` hands to the server. */
const actionsModule = (): string => `import type { ActionEntry } from '@plitzi/sdk-authoring';

/**
 * The space's server actions — what a page asks the server to do (\`runServerAction\`), what feeds a provider before the
 * HTML (\`apiContainer({ runtime: 'server', action })\`), what runs on a clock (a \`schedule\` trigger). One
 * \`defineAction({ … })\` from \`@plitzi/sdk-authoring\` each, listed here: \`src/main.ts\` hands them to the server.
 */
export const actions: ActionEntry[] = [];
`;

/** What `src/functions/` is, in the folder itself — and the folder there from the start, for `start:dev` to watch. */
const FUNCTIONS_README = `# ${FUNCTIONS_DIR}/

This project's own server code: the tasks a server action's steps run (\`task: 'namespace.action'\`) and the routes
under \`/fn/\`, from \`index.ts\` here — \`export default defineFunctions({ tasks, routes, allow })\` from
\`@plitzi/sdk-server/functions\`. \`src/main.ts\` builds it at boot the way Plitzi builds a space's, and \`start:dev\`
restarts on a change here. Nothing here, no functions.

\`plitzi functions pull\` writes the space's functions here, and \`push\` sends them back.

A file imports its siblings with their extension — \`import { reader } from './sources.ts'\` — as \`src/\` does: the
build reads it either way, and a script or a test then runs the same file under Node, with nothing to bundle.
`;

/** What `src/actions/` is, in the folder itself — and the folder there from the start, for `start:dev` to watch. */
const ACTIONS_README = `# src/actions/

The space's server actions: one \`defineAction({ … })\` from \`@plitzi/sdk-authoring\` per file, and, as JSON, any the
builder wrote in a form code has no words for. \`src/actions.ts\` lists them for the server, and \`start:dev\` restarts
on a change here.

\`plitzi pull\` brings the space's copies again; \`plitzi push\` sends them back.
`;

/** What `src/connectors/` is, in the folder itself — there from the start, for `start:dev` to watch. */
const CONNECTORS_README = `# src/connectors/

The space's connectors, as Plitzi kept them: one JSON manifest each, \`{ id, name, manifest }\`, which the space's
actions call. \`src/actions.ts\` hands them to the server, and \`start:dev\` restarts on a change here.
`;

export const serverFiles = (answers: CreateAnswers): ProjectFiles => ({
  'src/main.ts': serverMain({ source: answers.source, name: answers.name }),
  [`${FUNCTIONS_DIR}/README.md`]: FUNCTIONS_README,
  // The project's own data: read by its server, never served.
  [`${DATA_DIR}/.gitkeep`]: '',
  // Served to anyone as it is: pictures, a favicon.
  'public/.gitkeep': '',
  'src/serverOptions.ts': serverOptionsModule(answers.source !== 'cloud'),
  ...(answers.source === 'cloud' ? {} : { 'src/actions.ts': actionsModule() }),
  // A project made from a space: the folders its actions and connectors are, there for `start:dev` to watch.
  ...(answers.fromSpace
    ? { 'src/actions/README.md': ACTIONS_README, 'src/connectors/README.md': CONNECTORS_README }
    : {})
});
