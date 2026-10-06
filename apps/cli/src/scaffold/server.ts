import { ACTIONS_ENTRY, DATA_DIR, ENV_FILE, FUNCTIONS_DIR, KV_FILE, MAIN_FILE, SERVER_OPTIONS_FILE } from './paths';

import type { CreateAnswers, ProjectFiles } from './types';

/**
 * The server-mode entry point: a page server of this project's own — `serveProject` from `@plitzi/sdk-server/project`,
 * which wires everything else from where the project keeps it. What is the project's is three imports — its space, its
 * actions, its options — and the file is short enough to read whole. A fix to the server arrives with the package.
 */

export type ServerMainOptions = {
  source: CreateAnswers['source'];
  /** What `/health` answers with for a space read from Plitzi; a local one is named by its own permanent URL. */
  name: string;
  /** Whether the space's server actions run here (`src/actions/`): a local space's, or a cloud one's taken out with it. */
  actions: boolean;
};

/** One import line, broken over lines the way Prettier would once it is longer than the project's 120 columns. */
const namedImport = (names: readonly string[], from: string, type = false): string => {
  const keyword = type ? 'import type' : 'import';
  const line = `${keyword} { ${names.join(', ')} } from '${from}';`;

  return line.length <= 120 ? line : `${keyword} {\n  ${names.join(',\n  ')}\n} from '${from}';`;
};

/** A string as the project's Prettier writes one: in single quotes. */
const quoted = (text: string): string => `'${text.replace(/['\\]/g, char => `\\${char}`)}'`;

/**
 * The project's settings, in `.env` and out of git — what its actions sign with, a cloud project's key, the variables a
 * space was given on Plitzi — read by the process itself, so `start`, `start:dev` and `start:prod` find them alike, and
 * a deployment that sets them in its environment needs no file.
 *
 * A module of its own, imported first by the entry point, because an import is evaluated before the body of the module
 * importing it: read in `main.ts`'s body, `.env` arrived after `serverOptions.ts` and the actions had read
 * `process.env` at their top level, and found it empty. `../.env` is the project's root from `src/` and `dist/` alike.
 */
const envModule = (cloud: boolean): string => `/**
 * The project's settings — what its actions sign with${cloud ? ', the space key' : ''} — kept in \`.env\`, out of git. A
 * deployment that sets them in its environment needs no file.
 *
 * Imported first by \`${MAIN_FILE}\`: whatever it imports after this finds them in \`process.env\` as it loads.
 */
try {
  process.loadEnvFile(new URL('../.env', import.meta.url));
} catch {
  // None: the environment the process was started with is all there is.
}
`;

/** What the entry point says of itself: whose it is, and where what it does is said. */
const MAIN_DOC = `/**
 * The project's page server. \`serveProject\` wires the rest from where this project keeps it — its plugins, its
 * functions and runtime, \`public/\`, \`${DATA_DIR}/\`, the \`kv\` in \`${KV_FILE}\`, the port — and, while developing,
 * authors the space again on a save and reloads the open pages (\`@plitzi/sdk-server\`'s README, "Projects").
 *
 * This file is the CLI's: \`plitzi upgrade\` keeps it current. What the server does besides is
 * \`${SERVER_OPTIONS_FILE}\`.
 */`;

/**
 * The server-mode `src/main.ts`, for a project of its own and for one made from a space alike: the same server, port,
 * health, reloads and settings. What a project may hold besides — a runtime, plugins built only — is found by
 * `serveProject` where it lands, so one template serves every project and `plitzi upgrade` keeps it current in all of
 * them.
 */
export const serverMain = ({ source, name, actions }: ServerMainOptions): string => {
  const local = source === 'local';
  const ownImports = [
    ...(actions ? [namedImport(['actions', 'connectors'], './actions/index.ts')] : []),
    namedImport(['serverOptions'], './config/serverOptions.ts'),
    ...(local ? [namedImport(['space'], './space/index.ts')] : [])
  ];
  const spaceOption = local
    ? `  // The space, authored at boot and checked against what the project's files say — its plugins, its data.
  space: authorSpace(space, await projectAuthoring(new URL('..', import.meta.url))),`
    : `  // The space stays in Plitzi, read with \`PLITZI_HOST_KEY\` from \`.env\`; this is what \`/health\` answers with.
  cloud: { name: ${quoted(name)} },`;
  const authoringImports = local
    ? `\n${namedImport(['authorSpace'], '@plitzi/sdk-authoring')}\n${namedImport(['projectAuthoring'], '@plitzi/sdk-authoring/node')}\n`
    : '';

  return `// First: what follows reads its settings from \`process.env\` as it loads.
import './env.ts';

import { serveProject } from '@plitzi/sdk-server/project';
${authoringImports}
${ownImports.join('\n')}

${MAIN_DOC}
await serveProject({
  entry: import.meta.url,
${spaceOption}
${actions ? '  actions,\n  connectors,\n' : ''}  serverOptions
});
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

const serverOptionsModule = (
  local: boolean
): string => `import type { ProjectServerOptions } from '@plitzi/sdk-server/project';

/**
 * What this project's server does besides serving the space — yours. \`${MAIN_FILE}\` is the CLI's (\`plitzi upgrade\`
 * keeps it current) and hands these to \`serveProject\`, which wires the space, its plugins, its files and its code
 * itself — those are not offered here (\`ProjectServerOptions\`), and an action's \`lookups\` are \`${ACTIONS_ENTRY}\`.
 * The ones a project reaches for:
 *
 * - \`images: { domains: ['images.example.com'] }\` — pictures from those hosts resized here, with \`sharp\` installed.
${local ? ACTION_OPTIONS_DOC : ''} * - \`rsc: { elementTimeoutMs }\` — how long a section resolved on the server is waited for: 5 s by default.
 */
export const serverOptions: ProjectServerOptions = {};
`;

/** The space's server actions, in a file of the project's own that `src/main.ts` hands to the server. */
const actionsModule = (): string => `import type { ActionEntry } from '@plitzi/sdk-authoring';
import type { ActionLookups } from '@plitzi/sdk-server/actions';

type Connector = NonNullable<Awaited<ReturnType<NonNullable<ActionLookups['getConnector']>>>>;

/**
 * The space's server actions — what a page asks the server to do (\`runServerAction\`), what feeds a provider before the
 * HTML (\`apiContainer({ runtime: 'server', action })\`), what runs on a clock (a \`schedule\` trigger). One
 * \`defineAction({ … })\` from \`@plitzi/sdk-authoring\` each — a file each beside this one as they grow — listed here:
 * \`${MAIN_FILE}\` hands them to the server.
 */
export const actions: ActionEntry[] = [];

/** The connectors those actions call, by id — a connector's manifest, as Plitzi keeps one. */
export const connectors = new Map<string, Connector>();
`;

export const serverFiles = (answers: CreateAnswers): ProjectFiles => ({
  [MAIN_FILE]: serverMain({
    source: answers.source,
    name: answers.name,
    actions: answers.source === 'local' || Boolean(answers.fromSpace)
  }),
  [ENV_FILE]: envModule(answers.source !== 'local'),
  // There from the start, for \`start:dev\` to watch: what it is, \`plitzi/README.md\` says.
  [`${FUNCTIONS_DIR}/.gitkeep`]: '',
  // The project's own data: read by its server, never served.
  [`${DATA_DIR}/.gitkeep`]: '',
  // Served to anyone as it is: pictures, a favicon.
  'public/.gitkeep': '',
  [SERVER_OPTIONS_FILE]: serverOptionsModule(answers.source !== 'cloud'),
  ...(answers.source === 'cloud' ? {} : { [ACTIONS_ENTRY]: actionsModule() }),
  // A project made from a space: the folders its actions and connectors are, there for `start:dev` to watch.
  ...(answers.fromSpace ? { 'src/connectors/.gitkeep': '' } : {})
});
