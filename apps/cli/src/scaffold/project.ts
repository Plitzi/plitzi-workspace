import { createRequire } from 'node:module';

import { installCommand, managerFiles, runCommand } from './packageManager';

import type { CreateAnswers, ProjectFiles } from './types';

/**
 * The version range a generated project installs, taken from the SDK this CLI was published alongside.
 *
 * Read rather than written down: the packages are versioned in lockstep, so the one resolvable from here is the
 * one whose API the generated files were written against. A hard-coded range is a range somebody has to remember
 * to bump, and the failure when they forget is a project that installs a version missing what its own code calls.
 */
const require = createRequire(import.meta.url);

const SDK_VERSION = `^${(require('@plitzi/sdk-authoring/package.json') as { version: string }).version}`;

/**
 * What every generated project builds and checks itself with.
 *
 * React's types are here rather than in the browser half because both modes carry a plugin now, and a plugin is a
 * `.tsx` file wherever it renders. The lint stack is the same one Plitzi's own packages use — type-checked rules,
 * with Prettier owning layout and `eslint-config-prettier` keeping ESLint out of that argument.
 */
const SHARED_DEV_DEPENDENCIES = {
  '@eslint/js': '^10.0.1',
  '@playwright/test': '^1.56.1',
  '@types/node': '^26.2.0',
  '@types/react': '^19.2.18',
  '@types/react-dom': '^19.2.4',
  eslint: '^9.39.5',
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
  react: '^19.2.8',
  'react-dom': '^19.2.8'
});

const devDependencies = ({ mode }: CreateAnswers): Record<string, string> =>
  mode === 'server' ? { ...SHARED_DEV_DEPENDENCIES, tsx: '^4.23.12' } : { ...SHARED_DEV_DEPENDENCIES, vite: '^8.2.1' };

/**
 * What `start` means, which is the whole difference between the two modes.
 *
 * `client` runs Vite, so a save is a hot module replacement — the page updates without reloading, and editing the
 * space is a live loop. `server` runs the page server under `tsx watch`: there is no client bundle of this
 * project's own to hot-replace (the SDK is served by the server from its own copy), so a save restarts the
 * process and the next request renders the change. Both are one command; only one of them is HMR, and calling
 * the other one HMR would be a promise the loop does not keep.
 */
const scripts = ({ mode, source }: CreateAnswers): Record<string, string> => ({
  ...(mode === 'server'
    ? {
        start: 'node --import tsx src/main.ts',
        /**
         * Watched by PATH, not wholesale.
         *
         * The server compiles the project's plugins into `.sdk-plugins/` and then IMPORTS what it built, so a
         * bare `--watch` sees its own output land, restarts, compiles again, and never stops.
         */
        'start:dev': 'node --import tsx --watch-path=./src src/main.ts'
      }
    : {
        start: 'vite',
        build: 'vite build',
        preview: 'vite preview'
      }),
  ...(source === 'local' ? { author: 'node --import tsx src/author.ts' } : {}),
  typecheck: 'tsc -p tsconfig.json --noEmit',
  lint: 'eslint .',
  format: 'prettier --write .',
  visual: 'playwright test'
});

export const packageJson = (answers: CreateAnswers): string =>
  `${JSON.stringify(
    {
      name: answers.name,
      version: '0.0.0',
      private: true,
      type: 'module',
      scripts: scripts(answers),
      dependencies: dependencies(answers),
      devDependencies: devDependencies(answers)
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

/** Where the page server writes the plugin bundles it builds. A build output, and rebuilt whenever it is missing. */
const SERVER_IGNORES = '.sdk-plugins\n';

export const gitignore = ({ mode, packageManager }: CreateAnswers): string =>
  `node_modules\ndist\n.env\nvisual/.results\nvisual/screenshots\n${mode === 'server' ? SERVER_IGNORES : ''}${
    packageManager === 'yarn' ? YARN_IGNORES : ''
  }`;

const startLine = ({ mode, packageManager }: CreateAnswers): string =>
  mode === 'server'
    ? `\`${runCommand(packageManager, 'start')}\` serves pages on http://127.0.0.1:8080. \`${runCommand(packageManager, 'start:dev')}\` restarts on save.`
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

\`${runCommand(answers.packageManager, 'author')}\` writes the documents out as \`space/offline-data.json\`, for the moment you want the space
somewhere else — imported into Plitzi, handed to another server, or checked into a repository with no TypeScript
in it. Nothing here reads that file; the declaration is the source.`;
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

## The skills

\`.claude/skills/\` carries Plitzi's authoring skill, so an agent working in this repository knows how a space is
put together before it touches one. It is read by Claude Code automatically; nothing to wire.
`;

/**
 * The credential, and the prefix it has to carry.
 *
 * Vite only exposes variables named `VITE_*` to the browser, which is a safety rail rather than a formality: a
 * client build that read a bare `PLITZI_HOST_KEY` would either find nothing or — worse, if someone "fixed" the
 * prefix — ship a server credential to every visitor. The two modes therefore name different variables, because
 * they hold different keys.
 */
export const envFile = ({ key, environment, mode }: CreateAnswers): string =>
  mode === 'server'
    ? `# The space's self-hosting key. Secret: never commit it, never ship it in a page.
# Credentials, in the builder.
PLITZI_HOST_KEY=${key}

# Which version this serves. 'main' is what the builder is editing; a published environment serves the latest
# release, and PLITZI_REVISION pins one exact version.
PLITZI_ENVIRONMENT=${environment}
# PLITZI_REVISION=12

PORT=8080
`
    : `# The space's public render key. It ships in the page by design; the origin the browser states is what
# protects it — add this project's domain to the space's allowed domains.
VITE_PLITZI_WEB_KEY=${key}
VITE_PLITZI_ENVIRONMENT=${environment}
`;

export const projectFiles = (answers: CreateAnswers): ProjectFiles => ({
  ...managerFiles(answers.packageManager),
  'package.json': packageJson(answers),
  'tsconfig.json': tsconfig(answers),
  '.gitignore': gitignore(answers),
  'README.md': readme(answers),
  ...(answers.source === 'cloud' ? { '.env': envFile(answers) } : {})
});
