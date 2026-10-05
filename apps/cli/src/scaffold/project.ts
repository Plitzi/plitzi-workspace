import { createRequire } from 'node:module';

import { installCommand, managerFiles, managerPackageFields, runCommand } from './packageManager';
import { DEV_SERVER_FILE, KV_FILE, PROJECT_DATA, PROJECT_TMP } from './paths';

import type { CreateAnswers, ProjectFiles } from './types';

/**
 * The version range a generated project installs, taken from the SDK this CLI was published alongside.
 *
 * Read rather than written down: the packages are versioned in lockstep, so the one resolvable from here is the
 * one whose API the generated files were written against. A hard-coded range is a range somebody has to remember
 * to bump, and the failure when they forget is a project that installs a version missing what its own code calls.
 */
const require = createRequire(import.meta.url);

export const SDK_VERSION = `^${(require('@plitzi/sdk-authoring/package.json') as { version: string }).version}`;

/** The same version, bare: this CLI's own — what `--version` prints and what wrote a project's machinery. */
export const CLI_VERSION = SDK_VERSION.slice(1);

/**
 * What every generated project builds and checks itself with.
 *
 * React's types are here rather than in the browser half because both modes carry a plugin now, and a plugin is a
 * `.tsx` file wherever it renders. The lint stack is the same one Plitzi's own packages use — type-checked rules,
 * with Prettier owning layout and `eslint-config-prettier` keeping ESLint out of that argument.
 */
/** The React and the Vite every generated package is written against, project or plugin. */
export const REACT_VERSION = '^19.2.8';
export const VITE_VERSION = '^8.2.1';

export const SHARED_DEV_DEPENDENCIES = {
  '@eslint/js': '^10.0.1',
  '@playwright/test': '^1.56.1',
  '@types/node': '^26.2.0',
  '@types/react': '^19.2.18',
  '@types/react-dom': '^19.2.4',
  // The major `@eslint/js` declares as its peer: one apart and npm refuses to install the project at all.
  eslint: '^10.10.0',
  'eslint-config-prettier': '^10.1.8',
  'eslint-plugin-react-hooks': '^7.1.1',
  globals: '^17.11.0',
  prettier: '^3.9.6',
  typescript: '^6.0.3',
  'typescript-eslint': '^8.67.0'
};

const dependencies = ({ mode, source }: CreateAnswers): Record<string, string> => ({
  /**
   * The SDK is a direct dependency in BOTH modes, and in server mode that is not redundant.
   *
   * A plugin is a browser component: it imports `RootElement` so the element's id, classes and authored CSS land
   * on what it renders. A server-mode project therefore imports the SDK from `src/plugins`, even though what it
   * runs is the page server — and importing a package you have not declared is a package that disappears the
   * first time the one that pulled it in stops depending on it.
   */
  '@plitzi/plitzi-sdk': SDK_VERSION,
  ...(mode === 'server' ? { '@plitzi/sdk-server': SDK_VERSION } : {}),
  // Authoring is what turns `src/space.ts` into documents, so a local project always needs it. A cloud one never
  // does: its space is a document Plitzi holds, and nothing here builds one.
  ...(source === 'local' ? { '@plitzi/sdk-authoring': SDK_VERSION } : {}),
  react: REACT_VERSION,
  'react-dom': REACT_VERSION
});

/** A server-mode project runs no bundler of its own: the page server builds the plugins, and Node runs the rest. */
const devDependencies = ({ mode }: CreateAnswers): Record<string, string> => ({
  ...SHARED_DEV_DEPENDENCIES,
  // `shot`, `check`, `explain`, `data describe` and `upgrade` run from the project, at the version of the SDK.
  '@plitzi/cli': SDK_VERSION,
  ...(mode === 'server' ? {} : { vite: VITE_VERSION })
});

/**
 * Node runs this project's TypeScript itself — the server, `author`, `shot` — by stripping the types, which it does
 * without a flag from 22.18. Nothing transpiles beside the server: `tsx` did, and its loader thread cost a server
 * more memory than the server itself (~270 MB to start where the same server starts in ~90), which is the difference
 * between a small host and one that is killed on boot. The price is the one `tsconfig` enforces: relative imports
 * name their `.ts` file, and only syntax that erases (no `enum`, no parameter properties).
 */
const NODE_ENGINES = { node: '>=22.18' };

/**
 * What `start` means, which is the whole difference between the two modes.
 *
 * `client` runs Vite, so a save is a hot module replacement — the page updates without reloading, and editing the
 * space is a live loop. `server` runs the page server under Node's `--watch`: there is no client bundle of this
 * project's own to hot-replace (the SDK is served by the server from its own copy), so a save to the server's code
 * restarts the process — and a save to a local space is re-authored in place and the open page reloads. Both are one command; only one of them is HMR, and calling
 * the other one HMR would be a promise the loop does not keep.
 */
const scripts = ({ mode, source }: CreateAnswers): Record<string, string> => ({
  ...(mode === 'server'
    ? {
        start: 'node src/main.ts',
        /**
         * Watched by PATH, not wholesale.
         *
         * The server compiles the project's plugins into `tmp/.sdk-plugins/` and then IMPORTS what it built, so a
         * bare `--watch` sees its own output land, restarts, compiles again, and never stops. A local space is not
         * among them: `main.ts` re-authors it on save in a process of its own and the open pages load again
         * (`reloadPages`), so only the server's own code restarts it — its entry, options and actions, the plugins and
         * `functions/`.
         */
        'start:dev':
          source === 'local'
            ? 'node --watch-path=./src/main.ts --watch-path=./src/serverOptions.ts --watch-path=./src/actions.ts --watch-path=./src/plugins --watch-path=./functions src/main.ts'
            : 'node --watch-path=./src --watch-path=./functions src/main.ts',
        /**
         * What production runs: the same entry compiled to JavaScript. Node strips types by loading a TypeScript
         * transformer into the process — ~10 MB a server keeps for its whole life to read one file — so a deployment
         * runs what `build` emitted and carries no TypeScript at all.
         */
        build: 'tsc -p tsconfig.build.json',
        'start:prod': 'node dist/main.js'
      }
    : {
        start: 'vite',
        build: 'vite build',
        preview: 'vite preview'
      }),
  ...(source === 'local' ? { author: 'node src/author.ts' } : {}),
  // One line per error — file(line,col) and the message — rather than a framed excerpt of each.
  typecheck: 'tsc -p tsconfig.json --noEmit --pretty false',
  lint: 'eslint .',
  format: 'prettier --write .',
  visual: 'playwright test',
  // The CLI's, on the project's own Playwright: a picture of a page, and whether a page is whole — in text.
  shot: 'plitzi shot',
  check: 'plitzi check'
});

/**
 * `extra` is what a project made from a space needs besides (`plitzi create --from`): the packages its plugins and
 * runtime import. The scaffold's own win where both name one — the SDK and React are this CLI's versions, which the
 * project's plugins are rebuilt against.
 */
export const packageJson = (answers: CreateAnswers, extra: Record<string, string> = {}): string =>
  `${JSON.stringify(
    {
      name: answers.name,
      version: '0.0.0',
      private: true,
      type: 'module',
      scripts: scripts(answers),
      dependencies: Object.fromEntries(
        Object.entries({ ...extra, ...dependencies(answers) }).sort(([a], [b]) => a.localeCompare(b))
      ),
      devDependencies: devDependencies(answers),
      engines: NODE_ENGINES,
      ...managerPackageFields(answers.packageManager)
    },
    null,
    2
  )}\n`;

/**
 * What `build` compiles: the server's own code, to \`dist/\`, with each \`./space.ts\` import rewritten to the \`.js\` it
 * becomes. The plugins are left out — the page server builds those itself, from their source.
 */
export const tsconfigBuild = (): string =>
  `${JSON.stringify(
    {
      extends: './tsconfig.json',
      compilerOptions: {
        noEmit: false,
        outDir: 'dist',
        rootDir: 'src',
        rewriteRelativeImportExtensions: true
      },
      include: ['src'],
      exclude: ['src/plugins']
    },
    null,
    2
  )}\n`;

export const tsconfig = ({ mode }: CreateAnswers): string =>
  `${JSON.stringify(
    {
      compilerOptions: {
        target: 'ES2023',
        module: 'esnext',
        moduleResolution: 'bundler',
        strict: true,
        noEmit: true,
        esModuleInterop: true,
        skipLibCheck: true,
        resolveJsonModule: true,
        // What Node's own TypeScript support needs, checked here rather than found at `npm start`: a relative import
        // names its file, a type-only import says so, and nothing is written that stripping types would leave broken.
        allowImportingTsExtensions: true,
        verbatimModuleSyntax: true,
        erasableSyntaxOnly: true,
        /**
         * `vite/client` in the browser build, and it is not optional there: it is what declares a side-effect CSS
         * import and `import.meta.env`, both of which the entry point uses.
         */
        types: mode === 'client' ? ['node', 'vite/client'] : ['node'],
        lib: ['ES2023', 'DOM', 'DOM.Iterable'],
        jsx: 'react-jsx'
      },
      include: ['src', 'visual', 'playwright.config.ts', ...(mode === 'client' ? ['vite.config.ts'] : [])]
    },
    null,
    2
  )}\n`;

/**
 * Yarn's four lines are Yarn's own recommendation, and they are not decoration: with the `node-modules` linker it
 * writes `.yarn/install-state.gz` into the project, which is a cache and belongs in no repository.
 */
const YARN_IGNORES = '\n.yarn/*\n!.yarn/patches\n!.yarn/plugins\n!.yarn/releases\n!.yarn/versions\n';

/**
 * `tmp/` is everything the project writes for itself and `data/` what its server keeps (`./paths`); `.plitzi/` is what
 * the CLI records about it, and is committed — a clone without it could not pull, push or upgrade.
 */
export const gitignore = ({ mode, packageManager }: CreateAnswers): string =>
  `node_modules\ndist\n.env\n${PROJECT_TMP}\n${mode === 'server' ? `${PROJECT_DATA}\n` : ''}${packageManager === 'yarn' ? YARN_IGNORES : ''}`;

const startLine = ({ mode, packageManager, source }: CreateAnswers): string =>
  mode === 'server'
    ? `\`${runCommand(packageManager, 'start')}\` serves pages on http://127.0.0.1:8080 — or, when something else holds 8080, the next free port, which it prints and writes to \`${DEV_SERVER_FILE}\` (set \`PORT\` to choose one). \`${runCommand(packageManager, 'start:dev')}\` restarts on a save to the server's code${source === 'local' ? '; a save to the space reloads the open page' : ''}. In production, \`${runCommand(packageManager, 'build')}\` once and run \`${runCommand(packageManager, 'start:prod')}\` with \`NODE_ENV=production\`: the compiled server, with no TypeScript in the process.`
    : `\`${runCommand(packageManager, 'start')}\` runs Vite on http://127.0.0.1:5173, with hot module replacement.`;

const spaceSection = (answers: CreateAnswers): string => {
  if (answers.source === 'cloud') {
    return `## Where the space comes from

Plitzi. This project reads the live document with the key in \`.env\`, so the space keeps being edited, published
and versioned in the builder while what serves it is this.

\`PLITZI_ENVIRONMENT=main\` follows what the builder is editing, live. Point it at a published environment for
anything real, and set \`PLITZI_REVISION\` to pin one exact version.

**The key is secret** and \`.gitignore\` already covers \`.env\`. ${
      answers.mode === 'server'
        ? 'It is the *self-hosting* key, not the public one a published page embeds — a server has no origin to state, so its credential is protected by being secret.'
        : 'This is the public *render* key: it ships in the page by design, and what keeps a copied one from working is the origin the browser states.'
    }`;
  }

  return `## Where the space comes from

This project. \`src/space.ts\` is a copy of the space Plitzi gives a new account — declared as a tree, some CSS
and a palette rather than exported as a document, so it is yours to change. Every id and selector name is derived
from what is written there, so authoring it twice writes byte-identical documents.

Nothing is fetched and nothing is signed in to: there is no account, no key and no network in the picture.

\`${runCommand(answers.packageManager, 'author')}\` authors it and says what it found — warnings, suggestions, what a newer SDK changed. It
writes nothing: the declaration is the source, and \`npx plitzi push\` puts it on a space in Plitzi when you want it
there.`;
};

export const readme = (answers: CreateAnswers): string => `# ${answers.name}

A Plitzi space, rendered ${answers.mode === 'server' ? 'by a server of your own (SSR + RSC)' : 'in the browser, with no server at all'}.

\`\`\`bash
${installCommand(answers.packageManager)}
${runCommand(answers.packageManager, 'start')}
${runCommand(answers.packageManager, 'visual')}   # a browser opens the page and checks it rendered
\`\`\`

${startLine(answers)}

${spaceSection(answers)}

## Folders that are not the source

- \`public/\` is served to anyone who asks, as it is: every file in it is on the internet once the project is deployed.
  Data and pictures for every visitor go there — never a secret, a key, a private document or what only some visitors
  may read.
- \`${PROJECT_TMP}/\` is what the project writes for itself while it runs — the plugins it builds, the port it took, test
  output. Ignored by git, and rebuilt whenever it is missing.${
    answers.mode === 'server'
      ? `
- \`${PROJECT_DATA}/\` is what the server keeps for the space: its \`kv\` (\`${KV_FILE}\`) — saved layouts, counters, cached answers.
  The deployment's data, kept across restarts and never rebuilt; ignored by git. \`action.kv\` in \`src/serverOptions.ts\`
  keeps it elsewhere.`
      : ''
  }
- \`.plitzi/\` is what the CLI records about the project — the space it came from, its functions' working copy, the
  files \`create\` wrote — so \`plitzi pull\`, \`push\` and \`upgrade\` know where they stand. Commit it.

## The skills

\`.claude/skills/\` carries Plitzi's authoring skill, so an agent working in this repository knows how a space is
put together before it touches one, and the CLI's, so it knows what \`plitzi\` can do for it — plugins, packing,
uploading. Claude Code reads them automatically; \`AGENTS.md\` points any other agent at them.
`;

/**
 * What any agent opening the project reads first, whichever agent it is.
 *
 * The skill in \`.claude/skills/\` is found by Claude Code on its own; other agents look for \`AGENTS.md\`. So this
 * file carries the commands, where the space is, and the rules that go wrong most — and points at the skill for the
 * rest. \`CLAUDE.md\` imports it, so both kinds of agent start from the same page.
 */
export const agentsFile = (answers: CreateAnswers): string => {
  const code = (value: string): string => `\`${value}\``;
  const run = (script: string): string => code(runCommand(answers.packageManager, script));
  const local = answers.source === 'local';
  const where = local
    ? `The space is ${code('src/space.ts')}, declared with ${code('@plitzi/sdk-authoring')}. Edit that; never the JSON it produces.`
    : 'The space lives in Plitzi and is edited in the builder (or by an agent over MCP); this project serves it.';
  const commands = [
    `| ${code(installCommand(answers.packageManager))} | install |`,
    `| ${run('start')} | serve it |`,
    ...(local ? [`| ${run('author')} | author the space and print its warnings and suggestions |`] : []),
    `| ${run('visual')} | open the page in a browser and check it rendered |`
  ];
  const zeroWarnings = local ? `Zero warnings from ${run('author')}.` : 'Zero warnings from authoring.';
  const port =
    answers.mode === 'server'
      ? `${run('start')} serves on 8080, or on the next free port when something else holds it — printed, and written to ${code(DEV_SERVER_FILE)}, where ${code('check')}, ${code('shot')} and ${code('visual')} read it. ${code('PORT')} chooses one.`
      : `${run('start')} runs Vite on 5173.`;
  const serverNotes =
    answers.mode === 'server'
      ? `- **The server is yours in ${code('src/serverOptions.ts')}**, not in ${code('src/main.ts')} — that one is the CLI's, and ${code('plitzi upgrade')} keeps it current: what the server does besides serving the space goes there (what ${code('main.ts')} wires itself is not offered)${local ? `, and the space's server actions are ${code('src/actions.ts')}` : ''}.\n- **Pictures from other sites** are resized by this server once ${code('src/serverOptions.ts')} names their hosts — ${code('images: { domains }')}, a list of hosts like ${code('images.example.com')} — and ${code('sharp')} is installed: an ${code('image')} then offers a ${code('srcset')} (give it ${code('sizes')}, and ${code('width')}/${code('height')} so nothing jumps).\n`
      : '';
  const serverData =
    answers.mode === 'server'
      ? `; one whose ${code('runtime')} is ${code('server')} is read by the server, and the page arrives with it — bound the same way (${code('products.data.items')}), on a page or a layout, never inside a component`
      : '';
  const generated = [
    `- ${code(`${PROJECT_TMP}/`)} — what the project writes for itself while it runs: the plugins it built, the port it took${local ? ', the space as last authored' : ''}, test output. Never committed, rebuilt when missing.`,
    ...(answers.mode === 'server'
      ? [
          `- ${code(`${PROJECT_DATA}/`)} — what the server keeps for the space: its ${code('kv')} (${code(KV_FILE)}). The deployment's data — never committed, never rebuilt; ${code('action.kv')} in ${code('src/serverOptions.ts')} keeps it elsewhere.`
        ]
      : []),
    `- ${code('.plitzi/')} — what the CLI records about the project: where it came from, what it wrote. Committed; the CLI's to change.`
  ];

  return `# ${answers.name} — notes for agents

A Plitzi space, rendered ${answers.mode === 'server' ? 'by the server in this project (SSR + RSC)' : 'in the browser by a Vite app'}.
${where}

## Commands

| | |
| --- | --- |
${commands.join('\n')}

## This project

- **Port.** ${port}
- **Data with no backend** goes in ${code('public/data/*.json')}, served as it is and read by an ${code('apiContainer')} whose ${code('query')} is ${code('/data/products.json')}${serverData}.
- **${code('public/')} is on the internet.** Every file in it is served to anyone who asks for it, as it is, the moment the project is deployed — no sign-in, no check. Never put in it a secret, a key, a ${code('.env')}, a private document, a database dump, or data only some visitors may read: that goes through a server action or a provider that checks who is asking.
${serverNotes}- **Check a page in text first:** ${code(`${runCommand(answers.packageManager, 'check')} -- / --width 1440,390`)} says whether every element is on screen, nothing overflows and the console is clean — a picture only when it says something is wrong: ${code(`${runCommand(answers.packageManager, 'shot')} -- / --width 390`)} (add ${code('--scheme dark')}; ${code('--frames 4')} to see what moves; ${code('--compare <url>')} against another site: by section, and each text measured). ${run('visual')} runs the checks as tests.
- **What the page holds, in text:** ${code(`${runCommand(answers.packageManager, 'check')} -- /products --state --element <id>`)} adds its state, every source by name and one element (what it reads, its own state, whether it is on screen); every check already lists the flows that failed. Read it instead of guessing from classes in the DOM.

## Do not read

${[
  ...generated,
  `- A large ${code('public/data/*.json')} — ${code('npx plitzi data describe public/data/<file>.json')} prints its fields, their types and one row.`,
  `- The bundles in ${code('node_modules/@plitzi/*/dist/*.js')}. ${code('npx plitzi explain <name>')} says what an element, a step or a problem's code is; the ${code('.d.ts')} beside them documents the rest — search it, never read it whole.`
].join('\n')}

## Before anything else

Read ${code('.claude/skills/plitzi-authoring/SKILL.md')} — how a space is written, and the references it links to for
layouts, data, templates and flows. The types of ${code('@plitzi/sdk-authoring')} document every factory and field.
For a component of your own — a plugin — or anything about packing or uploading one, read
${code('.claude/skills/plitzi-cli/SKILL.md')} first: ${code('plitzi add plugin')} writes it in the shape everything reads.

## Keep the project clean

What you leave behind is the next reader's problem — the user's, or the next agent's. Before calling a change done:

- **Nothing unused.** Delete what you made and no longer use — a file, a page, a component, a class, a token, a data file, an import, a plugin folder. No commented-out code, no ${code('console.log')} left from debugging, no copy of a file kept "just in case": git keeps the history.
- **Scratch goes in ${code(`${PROJECT_TMP}/`)}, or nowhere.** A one-off script, a dump, a picture to look at — never at the root or beside the source, where it reads as part of the project.
- **One of everything.** A look used twice is a class; a value used twice is a token; a block used twice is a component, and rows of data are one list. Change it where it is defined, and rename everywhere when you rename.
- **Files a reader can find.** One part per file, named after what it is, in the folder of its kind — the shape ${code('src/space.ts')} already has. Do not start a parallel layout of your own.
- **Leave it passing.** ${local ? `${run('author')} with zero warnings, ` : ''}${run('typecheck')}, ${run('lint')} and ${run('format')} clean, and the page checked (${run('check')}).

## The rules that go wrong most

- Never write schema/style JSON by hand; author it. A refusal names the fix — fix the declaration; ${code('npx plitzi fix --write')} writes the ones with a single reading.
- After the ${code('@plitzi/*')} packages move, ${code('npx plitzi upgrade')}: what this project's CLI files, scripts, skills and renamed names should now be — ${code('--write')} makes it, a file you changed comes as a diff.
- ${zeroWarnings}
- Chrome shared by pages is a layout; a look used twice is a class; a block placed again with other content is a component, and rows of data are one ${code('list')} (a short menu may be a ${code('map')} in code).
- Ids are one namespace for the whole space: name what is referred to; a helper that runs more than once builds inside ${code('scope()')}.
- A file per part — the tokens, the layout, each component, each page — short enough to read whole; ${code('src/space.ts')} assembles them. ${code('npx plitzi create <dir> --template catalog')} is a complete example of the shape.
- Rebuilding a page the user owns: ${code('npx plitzi import <url>')} writes its tokens, outline and lists as a start — then split it into parts and write the content. It reads only a site whose domain the user verified on one of their spaces.
- Elements are visible by default. One the logic REVEALS starts hidden (${code('visible')}, or ${code('visible: false')} plus a computed binding) so nothing flashes while loading; one a flag HIDES stays shown while the flag is unset.
- Inside a template a source is spelled in full (${code('apiContainer_stats')}); an attribute only resolves ${code('{{ name|filter }}')}.
- Colours are tokens with light and dark values; times carry an explicit zone and say it.
- Go through ${code('.claude/skills/plitzi-authoring/reference/review-checklist.md')} before calling a change done.
`;
};

/**
 * The credential, and the prefix it has to carry.
 *
 * Vite only exposes variables named `VITE_*` to the browser, which is a safety rail rather than a formality: a
 * client build that read a bare `PLITZI_HOST_KEY` would either find nothing or — worse, if someone "fixed" the
 * prefix — ship a server credential to every visitor. The two modes therefore name different variables, because
 * they hold different keys.
 */
export const envFile = ({ key, environment, revision, mode }: CreateAnswers): string =>
  mode === 'server'
    ? `# The space's self-hosting key. Secret: never commit it, never ship it in a page.
# Credentials, in the builder.
PLITZI_HOST_KEY=${key}

# Which version this serves. 'main' is what the builder is editing; a published environment serves the latest
# release, and PLITZI_REVISION pins one exact version.
PLITZI_ENVIRONMENT=${environment}
${revision ? `PLITZI_REVISION=${String(revision)}` : '# PLITZI_REVISION=12'}

PORT=8080
`
    : `# The space's public render key. It ships in the page by design; the origin the browser states is what
# protects it — add this project's domain to the space's allowed domains.
VITE_PLITZI_WEB_KEY=${key}
VITE_PLITZI_ENVIRONMENT=${environment}
`;

export const projectFiles = (answers: CreateAnswers): ProjectFiles => ({
  ...managerFiles(answers.packageManager, answers.managerVersion),
  'package.json': packageJson(answers),
  'tsconfig.json': tsconfig(answers),
  ...(answers.mode === 'server' ? { 'tsconfig.build.json': tsconfigBuild() } : {}),
  '.gitignore': gitignore(answers),
  'README.md': readme(answers),
  'AGENTS.md': agentsFile(answers),
  // Claude Code reads CLAUDE.md, other agents AGENTS.md: one imports the other, so there is one text to keep true.
  'CLAUDE.md': '@AGENTS.md\n',
  ...(answers.source === 'cloud' ? { '.env': envFile(answers) } : {})
});
