import { actionSpecFromEntry, actionToSource } from '@plitzi/sdk-authoring';
import { PLUGIN_FUNCTIONS_SOURCE } from '@plitzi/sdk-shared/actions';

import { FUNCTIONS_DIR, MAIN_FILE } from './paths';
import { envFile, SDK_VERSION, withSigningSecret } from './project';
import { PROJECT_OUTPUTS, prettierignore } from './quality';
import { serverMain } from './server';

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
  /** Its functions as written in `src/functions/`, with the version of them Plitzi gave: `plitzi functions` reads both. */
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
export const actions: ActionEntry[] = [${names.length > 0 ? `\n  ${names.join(',\n  ')},` : ''}
  ...read('actions').flatMap(entry =>
    isRecord(entry) && typeof entry.id === 'string' && isRecord(entry.document)
      ? // A document Plitzi checked when it was saved, and that the server checks again on every run.
        [{ id: entry.id, document: entry.document as ActionEntry['document'] }]
      : []
  )
];

/** The space's connectors, as Plitzi kept them: one JSON manifest each, in \`src/connectors/\`, by id. */
export const connectors = new Map(
  read('connectors').flatMap(entry =>
    isRecord(entry) && typeof entry.id === 'string' && isRecord(entry.manifest)
      ? // A manifest Plitzi checked when it was saved.
        [[entry.id, entry.manifest as Connector] as const]
      : []
  )
);
`;
};

/** A path of the source tree, where the project keeps it: under `src/`, unless it was already a project's `src/`. */
const placeOf = (paths: readonly string[]) => {
  const prefix = paths.length > 0 && paths.every(path => path.startsWith('src/')) ? '' : 'src/';

  return (path: string): string => `${prefix}${path}`;
};

/**
 * Where the project keeps what the space's runtime and plugins are built from: the module the runtime starts at, and the
 * files each plugin's elements start at — the paths `create --from` writes them at, which `plitzi push` packs again.
 */
export const projectEntries = ({
  source
}: Pick<SpaceExport, 'source'>): {
  runtime: string | null;
  plugins: { type: string; entries: string[] }[];
  /** Every file of the source tree, where the project keeps it. */
  files: string[];
} => {
  const place = placeOf(Object.keys(source.files));
  const runtime = source.runtime?.entries[0];

  return {
    runtime: runtime ? place(runtime) : null,
    plugins: source.plugins.map(({ type, entries }) => ({ type, entries: entries.map(place) })),
    files: Object.keys(source.files).map(place)
  };
};

/** The import `src/main.ts` names the runtime's module by. */
const fromMain = (path: string): string => `./${path.replace(/^src\//, '')}`;

/** What the space was given on Plitzi, by name: the variables and credentials it needs here too. */
const spaceSettings = (exported: SpaceExport): string =>
  [
    '# What the space was given on Plitzi, by name — the values never leave it. Fill them in here.',
    ...exported.variables.map(name => `${name}=`),
    ...exported.credentials.map(
      ({ identifier, name, provider }) => `# ${name} (${provider}): the credential "${identifier}"`
    ),
    ''
  ].join('\n');

/**
 * The project's own `.env`, ready to run: what every server project is given — a signing key made for it, the space's
 * own stays on Plitzi; read from Plitzi, the key it is read with first — then what the space was given, left for
 * whoever has the values. Written once, by `create`: it is the project's, and nothing pulled ever touches it.
 */
export const envFromSpace = (exported: SpaceExport, answers: CreateAnswers, signingSecret: string): string =>
  `${withSigningSecret(envFile(answers), signingSecret)}\n${spaceSettings(exported)}`;

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
    files[`${FUNCTIONS_DIR}/${path}`] = text;
  });

  // A built plugin's server half, beside its bundle as \`plitzi pack plugin\` puts it: the platform keeps it privately,
  // so it came in the export rather than as a file on the CDN.
  builtOnly.plugins.forEach(({ type, functions: carried }) => {
    if (carried) {
      const sorted = Object.fromEntries(Object.entries(carried).sort(([a], [b]) => a.localeCompare(b)));
      files[`vendor/plugins/${type}/${PLUGIN_FUNCTIONS_SOURCE}`] = `${JSON.stringify(sorted, null, 2)}\n`;
    }
  });

  const runtimeEntry = source.runtime?.entries[0];
  if (builtOnly.runtime) {
    binaries['vendor/runtime.bundle'] = builtOnly.runtime;
  }

  files[MAIN_FILE] = serverMain({
    source: spaceSource,
    name: exported.space.permanentUrl,
    fromSpace: {
      ...(runtimeEntry ? { runtimeEntry: fromMain(place(runtimeEntry)) } : {}),
      packedRuntime: Boolean(builtOnly.runtime),
      builtPlugins: builtOnly.plugins.length > 0,
      visitorRoles: exported.visitorRoles
    }
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
  // What `.env` holds, with no value of it: a key the space is read with, the signing key, the space's settings.
  const example = envFile({
    name: '',
    mode: 'server',
    source: spaceSource,
    key: '',
    environment: 'main',
    packageManager: 'npm'
  });
  files['.env.example'] = `${example}\n${spaceSettings(exported)}`;
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
