import { actionSpecFromEntry, actionToSource } from '@plitzi/sdk-authoring';

import { projectDeclarations } from './plugin';
import { envFile, SDK_VERSION } from './project';
import { PROJECT_OUTPUTS, prettierignore } from './quality';
import { PLUGINS } from './server';

import type { CreateAnswers, ProjectFiles } from './types';
import type { SpaceExport } from '@plitzi/sdk-shared/source';

/**
 * A project made from a space Plitzi keeps (`plitzi create --from`, docs/en/projects-from-spaces.md): the server project `create` writes, with
 * the space's own pages, actions, functions, runtime, plugins and files in place of the example — and a page server
 * wired to run all of them, so it depends on nothing of Plitzi's.
 *
 * Pure, like the rest of the scaffold: what the project holds is asserted without a filesystem or a network.
 */

export type ProjectFromSpace = {
  /** Text files, written over the scaffold's. */
  files: ProjectFiles;
  /** Files whose bytes are not text — a font a plugin imports — in base64. */
  binaries: Record<string, string>;
  /** The space's files on its CDN, fetched into the project once and served by it from then on. */
  downloads: { url: string; to: string }[];
  /** The packages the project installs beyond the scaffold's: what its source imports, and the SDK it is written on. */
  dependencies: Record<string, string>;
  /** Its functions as written in `functions/`, with the version of them Plitzi gave: `plitzi functions` reads both. */
  functions: { version: string; files: Record<string, string> };
  /** The scaffold's example files a project from a space does not have. */
  omit: string[];
  /** What the person should know: what came across differently than it was, or not at all. */
  report: string[];
};

const TEXT = /\.((m|c)?(t|j)sx?|json|css|scss|sass|less|md|txt|html|svg|ya?ml|xml|csv|graphql)$/i;

/** Whether a file of the project is text — written, compared and formatted as such — rather than bytes. */
export const isTextFile = (path: string): boolean => TEXT.test(path);

/** The example plugin and space `create` writes for a project of its own, which one made from a space replaces. */
const EXAMPLE = ['src/plugins/StatCard/StatCard.tsx', 'src/plugins/StatCard/index.ts'];

const decode = (base64: string): string => Buffer.from(base64, 'base64').toString('utf-8');

/** One import line of the generated code. */
const importLine = (names: string, from: string): string => `import ${names} from '${from}';\n`;

/** `export { pizarra as space }`: the name the project's own code imports the space under, whatever it was exported as. */
const spaceEntry = (exportName: string): string => `/**
 * The space, as Plitzi kept it, written out as the code that authors it (\`./space/\`): a file per page, the shared
 * classes in \`styles.ts\`. It is this project's now — edit it, and the next start renders the change.
 */
export { ${exportName} as space } from './space/index.ts';
`;

/** An action written as code: its file, and the name the file exports it under. */
type CodedAction = { identifier: string; exportName: string };

/** The lines that import every action written as code, each under a name of its own however their ids camelCase. */
const codedImports = (coded: readonly CodedAction[]): { lines: string; names: string[] } => {
  const taken = new Set<string>();
  const imports = coded.map(({ identifier, exportName }) => {
    let name = exportName;
    for (let next = 2; taken.has(name); next += 1) {
      name = `${exportName}${String(next)}`;
    }

    taken.add(name);

    return {
      name,
      line: importLine(`{ ${name === exportName ? name : `${exportName} as ${name}`} }`, `./actions/${identifier}.ts`)
    };
  });

  return { lines: imports.map(({ line }) => line).join(''), names: imports.map(({ name }) => name) };
};

const actionsModule = (coded: readonly CodedAction[]): string => {
  const { lines, names } = codedImports(coded);

  return `import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
${lines ? `\n${lines}` : ''}
import type { ActionLookups } from '@plitzi/sdk-server/actions';

type ActionEntry = NonNullable<Awaited<ReturnType<ActionLookups['getAction']>>>;
type Connector = NonNullable<Awaited<ReturnType<NonNullable<ActionLookups['getConnector']>>>>;

/** The JSON documents of a folder beside this file: none when there is no such folder. */
const read = (folder: string): unknown[] => {
  const dir = path.join(import.meta.dirname, folder);
  try {
    return readdirSync(dir)
      .filter(file => file.endsWith('.json'))
      .map((file): unknown => JSON.parse(readFileSync(path.join(dir, file), 'utf-8')));
  } catch {
    return [];
  }
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

/**
 * The space's server actions, in \`src/actions/\`: one \`defineAction\` each — edit one, and the next start runs it —
 * and, as JSON, any the builder wrote in a form code has no words for. Their ways in say whether they are on.
 */
const actions: ActionEntry[] = [${names.length > 0 ? `\n  ${names.join(',\n  ')},` : ''}
  ...read('actions').flatMap(entry =>
    isRecord(entry) && typeof entry.id === 'string' && isRecord(entry.document)
      ? // A document Plitzi checked when it was saved, and that the server checks again on every run.
        [{ id: entry.id, document: entry.document as ActionEntry['document'] }]
      : []
  )
];

/** The space's connectors, as Plitzi kept them: one JSON manifest each, in \`src/connectors/\`. */
const connectors = new Map(
  read('connectors').flatMap(entry =>
    isRecord(entry) && typeof entry.id === 'string' && isRecord(entry.manifest)
      ? // A manifest Plitzi checked when it was saved.
        [[entry.id, entry.manifest as Connector] as const]
      : []
  )
);

/**
 * The one space this server serves, as its adapters name it — 1, whether they read it from this project or from
 * Plitzi: what the scheduler watches for actions on a clock.
 */
const SPACE_ID = 1;

export const lookups: ActionLookups = {
  getAction: (_spaceId, actionId) => Promise.resolve(actions.find(entry => entry.id === actionId)),
  listActions: () => Promise.resolve(actions),
  getConnector: (_spaceId, connectorId) => Promise.resolve(connectors.get(connectorId)),
  listScheduledSpaces: () => Promise.resolve([SPACE_ID])
};
`;
};

type MainOptions = {
  source: CreateAnswers['source'];
  /** The runtime's module, from `src/main.ts`, when its source came across. */
  runtimeEntry?: string;
  /** Its packed build, when only that did. */
  packedRuntime: boolean;
  /** Whether some plugin came across built only, in `vendor/plugins/`. */
  builtPlugins: boolean;
  /** The roles the space declares for its visitors. */
  visitorRoles: readonly string[];
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
 */`;

const BUILT_PLUGINS = `
/**
 * The space's plugins no source of was kept, as they were built: \`vendor/plugins/<type>/\`, each beside the manifest it
 * was published with. They run and render as they are — on the server too — and cannot be changed here: upload one
 * again from its source (\`plitzi upload plugin\`), and \`plitzi pull\` brings its code in their place.
 */
type BuiltManifest = {
  version?: string;
  pluginSchema?: Record<string, unknown>;
  assets?: Record<string, { src: string; type: string; isMain?: boolean }>;
};

const VENDOR_PLUGINS_DIR = path.resolve(import.meta.dirname, '../vendor/plugins');
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
      }
    };
  });
const builtPlugins = Object.fromEntries(built.map(({ type, source }) => [type, source]));
/** Every element type they provide, for the space's use of them to be authored as a plugin's rather than a typo's. */
const builtTypes = built.flatMap(({ type, provides }) => [type, ...provides]);
`;

const runtimeLines = ({ runtimeEntry, packedRuntime }: MainOptions): string => {
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

const fromSpaceMain = (options: MainOptions): string => {
  const { source, runtimeEntry, packedRuntime, builtPlugins, visitorRoles } = options;
  const hasRuntime = Boolean(runtimeEntry) || packedRuntime;
  const local = source === 'local';
  const fsImports = ['readdirSync', ...(packedRuntime || builtPlugins ? ['readFileSync'] : [])].join(', ');
  const allPlugins = builtPlugins ? '{ ...plugins, ...builtPlugins }' : 'plugins';
  const allNames = builtPlugins ? '[...pluginNames, ...Object.keys(builtPlugins)]' : 'pluginNames';
  const runtimeImports = [...(packedRuntime ? ['loadRuntime'] : []), ...(hasRuntime ? ['serveRuntime'] : [])].join(
    ', '
  );

  return `import { ${fsImports} } from 'node:fs';
import path from 'node:path';

import { closeOnSignals, consoleLogger, ${local ? 'createJsonAdapters' : 'createCloudAdapters'}, createServer, loadFunctions } from '@plitzi/sdk-server';
${hasRuntime ? importLine(`{ ${runtimeImports} }`, '@plitzi/sdk-server/runtime') : ''}${local ? `\n${importLine('{ authorSpace }', '@plitzi/sdk-authoring')}` : ''}
${importLine('{ lookups }', './actions.ts')}${local ? importLine('{ declarations }', './plugins/declarations.ts') : ''}${runtimeEntry ? importLine('spaceRuntime', runtimeEntry) : ''}${local ? importLine('{ space }', './space.ts') : ''}
/**
 * The project's settings — the key its actions sign with, the variables the space was given on Plitzi — kept in \`.env\`,
 * out of git. \`plitzi create\` wrote one with a fresh signing key; \`.env.example\` names the rest.
 */
try {
  process.loadEnvFile(new URL('../.env', import.meta.url));
} catch {
  // None: the environment the process was started with is all there is.
}

const PORT = Number(process.env.PORT ?? 8080);
// Loopback unless told otherwise: a container publishes a port only from an address it listens on (\`HOST=0.0.0.0\`).
const HOST = process.env.HOST ?? '127.0.0.1';
/** Where people reach this server: \`PUBLIC_URL\` behind a proxy, its own address otherwise. */
const publicUrl = (process.env.PUBLIC_URL ?? \`http://127.0.0.1:\${String(PORT)}\`).replace(/\\/+$/, '');
${builtPlugins ? BUILT_PLUGINS : ''}${
    local
      ? `
/**
 * The space, held in this project: \`src/space/\`, authored at boot — saving a page and letting \`--watch\` restart is
 * the whole edit loop, and the warnings are printed where somebody editing it is watching.
 */
const { schema, style, warnings } = authorSpace(space, { plugins: declarations${builtPlugins ? ', pluginTypes: builtTypes' : ''} });

for (const warning of warnings) {
  console.warn(\`[author] \${warning.message}\`);
}
`
      : `
/** The space's HOST key (Credentials, in the builder): secret, never committed, never shipped in a page. */
const HOST_KEY = process.env.PLITZI_HOST_KEY ?? '';

if (!HOST_KEY) {
  throw new Error('Set PLITZI_HOST_KEY in .env — Credentials, in the builder.');
}
`
  }
${PLUGINS}

/** The space's functions: \`functions/\`, built the way Plitzi builds them and run here, in this process. */
const functions = await loadFunctions(new URL('../functions/', import.meta.url));
${hasRuntime ? `\n${runtimeLines(options)}\n` : ''}${visitorRoles.length > 0 ? `${visitorsNote(visitorRoles)}\n` : ''}
/**
 * Everything the space is, served by this server alone: its pages, its plugins, its server actions (\`src/actions/\`),
 * its functions${hasRuntime ? ' and runtime' : ''}, and its files (\`public/\`, where Plitzi's CDN served them from).
 */
const server = createServer(
  {
    port: PORT,
    devMode: process.env.NODE_ENV !== 'production',
    adapters: ${
      local
        ? `createJsonAdapters({
      offlineData: { schema, style },
      deployment: { spaceId: 1, environment: 'main', revision: 0, pluginNames: ${allNames} }
    })`
        : `createCloudAdapters({
      webKey: HOST_KEY,
      ...(process.env.PLITZI_SERVER_URL ? { serverUrl: process.env.PLITZI_SERVER_URL } : {}),
      environment: (process.env.PLITZI_ENVIRONMENT ?? 'main') as 'main' | 'production',
      deployment: { pluginNames: ${allNames} }
    })`
    },
    plugins: ${allPlugins},
    publicDir: path.join(PROJECT_ROOT, 'public'),
    functions: { native: ${hasRuntime ? '[...functions, ...runtime.native]' : 'functions'} },
    // What \`ctx.sign\` and \`ctx.verify\` sign with: the key that was the space's on Plitzi stays there.
    action: { lookups, signingSecret: process.env.PLITZI_SIGNING_SECRET },
    logger: consoleLogger
  }${hasRuntime ? ',\n  { preAuth: [runtime.stage] }' : ''}
);

server.listen(PORT, HOST);
console.log(\`pages on \${publicUrl}/\`);

closeOnSignals(server${hasRuntime ? ', { afterClose: () => runtime.close() }' : ''});
`;
};

/** A path of the source tree, where the project keeps it: under `src/`, unless it was already a project's `src/`. */
const placeOf = (paths: readonly string[]) => {
  const prefix = paths.length > 0 && paths.every(path => path.startsWith('src/')) ? '' : 'src/';

  return (path: string): string => `${prefix}${path}`;
};

/** The import `src/main.ts` names the runtime's module by. */
const fromMain = (path: string): string => `./${path.replace(/^src\//, '')}`;

/** What the space was given on Plitzi, by name, as `.env.example` lists it — and `.env`, with values where they are known. */
const settingsLines = (exported: SpaceExport): string[] => [
  '# What the space was given on Plitzi, by name — the values never leave it. Copy this to .env and fill them in.',
  '# What the project signs with (ctx.sign): at least 32 characters, secret.',
  'PLITZI_SIGNING_SECRET=',
  ...exported.variables.map(name => `${name}=`),
  ...exported.credentials.map(
    ({ identifier, name, provider }) => `# ${name} (${provider}): the credential "${identifier}"`
  ),
  'PORT=8080',
  ''
];

/**
 * The project's own `.env`, ready to run: a signing key made for it — the space's own stays on Plitzi — and the rest
 * left for whoever has the values. Read from Plitzi, the key it is read with comes first, as a project of its own has
 * it. Written once, by `create`: it is the project's, and nothing pulled ever touches it.
 */
export const envFromSpace = (exported: SpaceExport, answers: CreateAnswers, signingSecret: string): string => {
  const settings = settingsLines(exported)
    .join('\n')
    .replace('PLITZI_SIGNING_SECRET=', `PLITZI_SIGNING_SECRET=${signingSecret}`);

  // Read from Plitzi, the key it is read with and the version it serves come first — the port with them.
  return answers.source === 'cloud' ? `${envFile(answers)}\n${settings}\n` : `${settings}\nPORT=8080\n`;
};

/** What a project made from a space holds, from what the platform answered for it — the same for `create` and `pull`. */
export const projectFromSpace = (exported: SpaceExport, spaceSource: CreateAnswers['source']): ProjectFromSpace => {
  const { source, builtOnly, assets, report } = exported;
  const place = placeOf(Object.keys(source.files));
  // Plitzi's CDN addresses, as the project serves the same files: from its own root.
  const local = (text: string): string =>
    assets.reduce((written, { url, path }) => written.split(url).join(`/${path}`), text);

  const files: ProjectFiles = {};
  const binaries: Record<string, string> = {};
  Object.entries(source.files).forEach(([path, content]) => {
    if (isTextFile(path)) {
      files[place(path)] = local(decode(content));
    } else {
      binaries[place(path)] = content;
    }
  });

  if (exported.authoring) {
    Object.entries(exported.authoring.files).forEach(([path, text]) => {
      files[`src/space/${path}`] = local(text);
    });
    files['src/space.ts'] = spaceEntry(exported.authoring.exportName);
    const folders = Object.keys(files)
      .map(path => /^src\/plugins\/([^/]+)\/declaration\.ts$/.exec(path)?.[1])
      .filter((folder): folder is string => folder !== undefined)
      .sort();
    files['src/plugins/declarations.ts'] = projectDeclarations(folders);
  }

  // As the code that declares each one where it reads back exactly, and as the JSON it is where it does not.
  const coded: CodedAction[] = [];
  const asJson: string[] = [];
  exported.actions.forEach(({ identifier, name, document }) => {
    const reading = actionSpecFromEntry({ id: identifier, document });
    if (reading.ok) {
      const { exportName, source: code } = actionToSource(reading.spec);
      files[`src/actions/${identifier}.ts`] = local(code);
      coded.push({ identifier, exportName });

      return;
    }

    files[`src/actions/${identifier}.json`] = `${local(JSON.stringify({ id: identifier, name, document }, null, 2))}\n`;
    asJson.push(`src/actions/${identifier}.json stays JSON: ${reading.reason}`);
  });
  exported.connectors.forEach(({ identifier, name, manifest }) => {
    files[`src/connectors/${identifier}.json`] = `${JSON.stringify({ id: identifier, name, manifest }, null, 2)}\n`;
  });
  files['src/actions.ts'] = actionsModule(coded);
  const functions = Object.fromEntries(
    Object.entries(exported.functions.files).map(([path, text]) => [path, local(text)])
  );
  Object.entries(functions).forEach(([path, text]) => {
    files[`functions/${path}`] = text;
  });

  const runtimeEntry = source.runtime?.entries[0];
  if (builtOnly.runtime) {
    binaries['vendor/runtime.bundle'] = builtOnly.runtime;
  }

  files['src/main.ts'] = fromSpaceMain({
    source: spaceSource,
    ...(runtimeEntry ? { runtimeEntry: fromMain(place(runtimeEntry)) } : {}),
    packedRuntime: Boolean(builtOnly.runtime),
    builtPlugins: builtOnly.plugins.length > 0,
    visitorRoles: exported.visitorRoles
  });

  // The packages the source imports, at the ranges it was written against — but the SDK and React, which are this
  // CLI's: the plugins are rebuilt against the project's, and the report says when that is a different version.
  const extra = Object.fromEntries(
    Object.entries(source.dependencies).filter(
      ([name]) => !name.startsWith('@plitzi/') && !['react', 'react-dom'].includes(name)
    )
  );
  const plitzi = Object.fromEntries(
    [...Object.keys(source.dependencies), ...(coded.length > 0 ? ['@plitzi/sdk-authoring'] : [])]
      .filter(name => name.startsWith('@plitzi/'))
      .map(name => [name, SDK_VERSION])
  );
  const variables = [...exported.variables, ...exported.credentials.map(({ identifier }) => identifier)];
  files['.env.example'] = `${settingsLines(exported).join('\n')}\nPORT=8080\n`;
  // What was downloaded is served as it came: a built plugin's bytes are what its manifest's integrity names.
  files['.prettierignore'] = `${prettierignore(PROJECT_OUTPUTS)}public\nvendor\n`;

  const lines: string[] = [
    ...report.conflicts.map(
      ({ path, kept, others }) =>
        `${place(path)}: ${kept} and ${others.join(', ')} held different copies; ${kept}'s is kept`
    ),
    ...report.rangeConflicts.map(
      ({ name, kept, others }) => `${name}: asked for at ${[kept, ...others].join(' and ')}; ${kept} is written`
    ),
    ...Object.entries(source.dependencies)
      .filter(([name, range]) => name.startsWith('@plitzi/') && range !== SDK_VERSION)
      .map(([name, range]) => `${name}: the source was written against ${range}, and the project runs ${SDK_VERSION}`),
    ...source.plugins.flatMap(({ type, entries }) => {
      const entry = place(entries[0] ?? '');
      const folder = /^src\/plugins\/([^/]+)\/index\.ts$/.exec(entry)?.[1];

      return folder && `${folder.charAt(0).toLowerCase()}${folder.slice(1)}` === type
        ? []
        : [
            `${type}: its source starts at ${entry}, and the project registers src/plugins/<Name>/index.ts — move it there`
          ];
    }),
    ...builtOnly.plugins.map(
      ({ type }) =>
        `${type}: no source of this plugin was kept, so it runs as it was built (vendor/plugins/${type}/) and cannot be changed — upload it again from its source with plitzi upload plugin`
    ),
    ...(builtOnly.runtime
      ? ['The runtime came across built only (vendor/runtime.bundle): it runs, and cannot be changed']
      : []),
    ...asJson,
    ...(exported.visitorRoles.length > 0
      ? [
          `Its visitors (${exported.visitorRoles.join(', ')}) signed in with Plitzi: here nobody signs in until the server does it itself — see the note in src/main.ts`
        ]
      : []),
    ...report.corrections,
    ...(variables.length > 0 ? [`Give the project its variables and credentials in .env: ${variables.join(', ')}`] : [])
  ];

  return {
    files,
    binaries,
    downloads: [
      ...assets.map(({ url, path }) => ({ url, to: `public/${path}` })),
      ...builtOnly.plugins.flatMap(({ type, files: built }) =>
        built.map(({ url, path }) => ({ url, to: `vendor/plugins/${type}/${path}` }))
      )
    ],
    dependencies: { ...extra, ...plitzi },
    functions: { version: exported.functions.version, files: functions },
    omit: EXAMPLE.filter(path => !Object.hasOwn(files, path)),
    report: lines
  };
};
