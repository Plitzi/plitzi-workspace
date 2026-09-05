/**
 * The files a new server is made of, as pure functions of what the person answered.
 *
 * Separated from the command that writes them so the contents can be asserted without a filesystem — and because the
 * interesting part of this feature is what the files SAY. A scaffold that produces a project nobody can read is a
 * project its owner will replace rather than learn from, so each file carries the reasoning that would otherwise
 * live in documentation they have not opened yet.
 */

export const HOST_KEY_HINT = 'Credentials → self-hosting key, in the builder';

export interface ScaffoldAnswers {
  name: string;
  key: string;
  environment: string;
}

export const packageJson = ({ name }: ScaffoldAnswers): string =>
  `${JSON.stringify(
    {
      name,
      version: '0.0.0',
      private: true,
      type: 'module',
      scripts: {
        start: 'node --use-system-ca --import tsx src/main.ts',
        'start:dev': 'NODE_OPTIONS=--use-system-ca tsx watch src/main.ts',
        typecheck: 'tsc -p tsconfig.json --noEmit'
      },
      dependencies: {
        '@plitzi/sdk-server': '^0.27.0',
        react: '^19.2.8',
        'react-dom': '^19.2.8'
      },
      devDependencies: {
        '@types/node': '^26.2.0',
        tsx: '^4.23.12',
        typescript: '^6.0.3'
      }
    },
    null,
    2
  )}\n`;

export const tsconfig = (): string =>
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
        types: ['node'],
        lib: ['ES2023', 'DOM', 'DOM.Iterable'],
        jsx: 'react-jsx',
        resolveJsonModule: true
      },
      include: ['src']
    },
    null,
    2
  )}\n`;

export const mainTs =
  (): string => `import { consoleLogger, createCloudAdapters, createServer } from '@plitzi/sdk-server';

const PORT = Number(process.env.PORT ?? 8080);

/**
 * The space's HOST key — not the public one the published page embeds.
 *
 * They are different credentials on purpose. The public \`render\` key is readable by anyone who views source on the
 * published site, and what keeps a copied one from working is that a browser is made to state the origin it is
 * presenting from. A server has no such statement to make, so it gets a key whose protection is that it is secret:
 * issued once, never committed, never shipped in a page, and revocable on its own without touching the live site.
 */
const HOST_KEY = process.env.PLITZI_HOST_KEY ?? '';

if (!HOST_KEY) {
  throw new Error('Set PLITZI_HOST_KEY in .env — ${HOST_KEY_HINT}.');
}

/**
 * The space stays in Plitzi; the SERVER is this one.
 *
 * The live document is read over the same query the browser-rendered SDK uses, so the space keeps being edited,
 * published and versioned in the builder while every request is served from here — under this deployment's own
 * domain, auth, actions and logs.
 *
 * \`environment\` is the one decision worth being deliberate about:
 *
 * - \`main\` is the document the builder is editing. Read live on every request, never cached. A development target.
 * - A published environment with no \`revision\` serves the LATEST and releases itself.
 * - A published environment WITH a \`revision\` serves exactly that version — for a deployment that rolls forward
 *   on its own schedule.
 */
const adapters = createCloudAdapters({
  webKey: HOST_KEY,
  ...(process.env.PLITZI_SERVER_URL ? { serverUrl: process.env.PLITZI_SERVER_URL } : {}),
  environment: (process.env.PLITZI_ENVIRONMENT ?? 'main') as 'main' | 'production',
  ...(process.env.PLITZI_REVISION ? { revision: Number(process.env.PLITZI_REVISION) } : {})
});

const server = createServer({
  port: PORT,
  devMode: process.env.NODE_ENV !== 'production',
  adapters,
  logger: consoleLogger
});

server.listen(PORT, '127.0.0.1');
console.log(\`pages on http://127.0.0.1:\${PORT}/\`);
`;

export const envFile = ({ key, environment }: ScaffoldAnswers): string =>
  `# The space's self-hosting key. Secret: never commit it, never ship it in a page.
# ${HOST_KEY_HINT}.
PLITZI_HOST_KEY=${key}

# Which version this server serves. 'main' is what the builder is editing; a published environment
# (e.g. 'production') serves the latest release, and PLITZI_REVISION pins one exact version.
PLITZI_ENVIRONMENT=${environment}
# PLITZI_REVISION=12

# Point at a staging or local Plitzi. Left unset this reads from Plitzi's production server.
# PLITZI_SERVER_URL=https://server.plitzi.com

PORT=8080
`;

export const gitignore = (): string => 'node_modules\n.env\n';

export const readme = ({ name }: ScaffoldAnswers): string => `# ${name}

A server that renders a Plitzi space. The space stays in Plitzi — edited, published and versioned in the builder —
and every request is served from here.

\`\`\`bash
npm install
npm start          # http://127.0.0.1:8080
npm run start:dev  # the same, restarting on save
\`\`\`

## The credential

\`PLITZI_HOST_KEY\` in \`.env\` is the space's **self-hosting** key, which is secret. It is not the public \`render\`
key a published page embeds: that one is protected by the origin a browser states, and a server states none. Keep it
out of version control (\`.gitignore\` already does), and revoke it on its own if it leaks — the live site is not
affected.

## Which version is served

\`PLITZI_ENVIRONMENT=main\` follows what the builder is editing, live, on every request. Point it at a published
environment for anything real, and set \`PLITZI_REVISION\` when you want the deployment to roll forward on its own
schedule rather than releasing itself.
`;

/** Every file, by the path it is written to. One list, so the command has nothing to keep in step. */
export const scaffold = (answers: ScaffoldAnswers): Record<string, string> => ({
  'package.json': packageJson(answers),
  'tsconfig.json': tsconfig(),
  'src/main.ts': mainTs(),
  '.env': envFile(answers),
  '.gitignore': gitignore(),
  'README.md': readme(answers)
});
