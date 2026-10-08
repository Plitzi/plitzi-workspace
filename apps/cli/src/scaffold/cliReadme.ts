import { AUTHOR_FILE, CLI_DIR, DATA_DIR, FUNCTIONS_DIR, MAIN_FILE, RUNTIME_DIR } from './paths';

import type { CreateAnswers } from './types';

/**
 * `plitzi/README.md`: what the CLI's folder holds, and what each folder of `src/` is — said once, here, rather than in a
 * README inside every folder of the project's own, where it was one more file to wade past.
 */

const PLUGINS = ({ mode }: CreateAnswers): string => `## \`src/plugins/\` — components of your own

Every folder is one, registered under its name in camelCase — \`StatCard\` is the type \`statCard\` — and built from
its \`index.ts\` (or \`index.tsx\`): code several plugins share goes outside \`src/plugins/\`. Its \`declaration.ts\` says
what it fires, answers and reads, and the space places it from there — \`const statCard =
defineElement<StatCardAttributes>(statCardDeclaration)\`, then \`statCard({ id: 'stats', … })\` — an element of its own
type, whose attributes arrive as the component's props, typed by what it declares. The space is checked against every
folder's declaration, found by folder like the plugins themselves.

${
  mode === 'server'
    ? `The server (\`serveProject\`, which \`${MAIN_FILE}\` starts) registers each one with \`action: 'compile'\`, which is
what makes it **server-rendered**: the server builds the entry with esbuild, keeps React external so the plugin runs
on the one copy the page already has, serves the bundle to the browser AND imports it into the render — so the
component's markup is in the HTML before any JavaScript arrives. With \`start:dev\` running, a saved plugin is swapped into the open page without reloading it,
and a new folder is registered as it appears.

A plugin can bring server code of its own: \`plugin add board --server\` writes \`Board/functions/index.ts\`, whose
routes answer under \`/fn/plugins/board/\` — the component names them with \`usePluginRoute('board')\` — with a \`kv\`
of the plugin's own.`
    : `\`${MAIN_FILE}\` hands them to \`render()\`. There is no server here, so each one is part of this project's own
bundle and Vite hot-replaces it like any other module.`
}

\`npx @plitzi/cli plugin add seat-picker\` writes \`src/plugins/SeatPicker/\`: the component, its declaration, the panel
the builder edits it with, and the \`index.ts\` that hands them over.

- **Render \`RootElement\`, not a \`div\`.** The id and classes the space gave it land on what you render, so the CSS
  authored on the element applies, the builder can select it, and a test can find it by name.
- **Render the same thing on the server and on the first client pass** — a clock, a random number, anything read out
  of \`window\` belongs in an effect: React answers a hydration mismatch by discarding the whole tree.
- **Do not name colours.** Use \`currentColor\` and the space's own \`var(--…)\` variables: a hard-coded \`#111\` is
  invisible in one of the themes.
`;

const FUNCTIONS = `## \`${FUNCTIONS_DIR}/\` — the project's own server code

The tasks a server action's steps run (\`task: 'namespace.action'\`) and the routes under \`/fn/\`, from \`index.ts\` —
\`export default defineFunctions({ tasks, routes, allow })\` from \`@plitzi/sdk-server/functions\`. The server builds
it at boot the way Plitzi builds a space's, and \`start:dev\` restarts on a change there. Nothing there, no functions.
\`plitzi functions pull\` writes the space's functions there, and \`push\` sends them back. A file imports its siblings
with their extension — \`import { reader } from './sources.ts'\`.
`;

const RUNTIME = `## \`${RUNTIME_DIR}/\` — the space's runtime, when it has one

Its own server code, run as a process of its own beside the space on Plitzi — Node, its packages, a connection held
open — and by the server here, in its process: \`npx @plitzi/cli runtime add\` writes \`index.ts\`, and
\`plitzi runtime push\` sends the module it is, tried here first.
`;

const DATA = ({ mode }: CreateAnswers): string =>
  mode === 'server'
    ? `## \`${DATA_DIR}/\` — the project's own data

JSON the server reads and never serves: a provider with \`runtime: 'server'\` and \`query: '/data/products.json'\` reads
\`${DATA_DIR}/products.json\`, and the page arrives with it. What a provider reads is in the page it renders — data a page
must not carry is a server action's to read, answering only what is shown.
`
    : `## \`public/data/\` — data with no backend

JSON the browser fetches — \`query: '/data/products.json'\` — and so public, like everything in \`public/\`.
`;

const FROM_SPACE = `## \`src/actions/\` and \`src/connectors/\` — what the space was made of

The space's server actions — one \`defineAction({ … })\` per file, or JSON where code has no words for one — and its
connectors, one JSON manifest each. \`src/actions/index.ts\` hands them to the server, and \`start:dev\` restarts on a change
to either. \`plitzi space pull\` brings the space's copies again; \`plitzi space push\` sends them back.
`;

export const cliReadme = (answers: CreateAnswers): string => {
  const server = answers.mode === 'server';

  return `# ${CLI_DIR}/ — the CLI's part of this project

What the project needs of the CLI besides its entry point, kept apart from \`src/\`. \`plitzi upgrade\` brings these files
up to the CLI it has — and \`${MAIN_FILE}\` with them, in \`src/\` because that is where an entry
point is looked for. One changed is shown as a diff and left, so changing one is taking it over. \`plitzi doctor\` holds the
whole project to what follows — and to what Node, the server and \`space push\` need of it — and says what to fix.

- \`${MAIN_FILE}\` (in \`src/\`) — the entry point: ${server ? 'the page server — the space authored and handed to `serveProject` (`@plitzi/sdk-server/project`), which wires its plugins, its data and its code from where they are' : 'the Vite app that renders the space'}.${
    answers.source === 'local'
      ? `\n- \`${AUTHOR_FILE}\` — \`npm run author\`: authors \`src/space/\` and says what it found${server ? '; the server runs it on every save, and is handed the documents it serves next' : ''}.`
      : ''
  }${
    server
      ? `\n- \`${CLI_DIR}/assets.d.ts\` — the types of what a plugin imports besides code: a stylesheet, an image, \`?raw\`, \`?inline\`.`
      : `\n- \`${CLI_DIR}/preflight.css\` — the page's base styles.`
  }

${server ? 'What the server does besides serving the space is yours, in `src/config/serverOptions.ts`.\n\n' : ''}${PLUGINS(answers)}
${server ? `${FUNCTIONS}\n${RUNTIME}\n` : ''}${DATA(answers)}${answers.fromSpace ? `\n${FROM_SPACE}` : ''}`;
};
