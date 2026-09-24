import type { PluginNames } from './names';
import type { ProjectFiles } from '../types';

/**
 * How a plugin becomes something a space can load: one ES module, a manifest describing it, and a zip the builder
 * takes.
 *
 * The contract is the platform's, and the parts of it that are not obvious are written down where they are enforced:
 * React and the SDK are the page's, never the bundle's; the code is one file, because it is imported from a blob URL
 * that has no directory for a second chunk to be found in; and the manifest names the file a page loads, with the hash
 * the browser checks it against.
 */

const viteConfig = ({ base }: PluginNames): string => `import { createReadStream, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';

import { defineConfig } from 'vite';

import { manifest } from './build/manifest.ts';

import type { Plugin } from 'vite';

const require = createRequire(import.meta.url);

const packageJson = readFileSync(new URL('./package.json', import.meta.url), 'utf-8');
const { version } = JSON.parse(packageJson) as { version: string };

/**
 * What the page already runs, and the plugin must never bring a second copy of.
 *
 * A space loads the plugin into a page that has React and the SDK — the page server's import map names both — so the
 * bundle imports them rather than carrying them. A second React is "Invalid hook call" and a blank element; a second
 * SDK is an element that cannot see the space it is in.
 */
const EXTERNAL = /^(react|react-dom|@plitzi\\/plitzi-sdk)(\\/.*)?$/;

/**
 * Serves the dev tools' stylesheet at the path the SDK asks for, in the preview.
 *
 * They render into a shadow root, which cannot see this page's styles, so they fetch a stylesheet of their own from
 * \`/plitzi-sdk-devtools.css\` — a path that exists on a server serving the SDK's assets and nowhere else. Development
 * only, and read from \`node_modules\` on each request, so it cannot go stale against the installed SDK.
 */
const devToolsStylesheet = (): Plugin => ({
  name: 'plitzi-devtools-stylesheet',
  apply: 'serve',
  configureServer(server) {
    server.middlewares.use('/plitzi-sdk-devtools.css', (_request, response) => {
      response.setHeader('Content-Type', 'text/css');
      createReadStream(require.resolve('@plitzi/plitzi-sdk/plitzi-sdk-devtools.css')).pipe(response);
    });
  }
});

/**
 * \`start\` serves the preview (\`index.html\`, the plugin inside a space); \`build\` writes the plugin to \`dist/\`.
 *
 * The host is pinned because Vite binds \`localhost\` — IPv6 on most machines — while what waits for a dev server,
 * the visual test included, asks for 127.0.0.1.
 */
export default defineConfig(({ command }) => ({
  plugins: [devToolsStylesheet(), manifest({ version })],
  // A library build leaves \`process.env.NODE_ENV\` as it was written, and a browser has no \`process\` to read it from.
  define: command === 'build' ? { 'process.env.NODE_ENV': JSON.stringify('production') } : {},
  server: { host: '127.0.0.1', port: 5173 },
  build: {
    lib: { entry: 'src/index.ts', formats: ['es'], fileName: () => '${base}.mjs', cssFileName: '${base}' },
    rolldownOptions: {
      external: (id: string) => EXTERNAL.test(id),
      // One file: the page imports it from a blob URL, where a second chunk has nowhere to be found.
      output: { codeSplitting: false }
    }
  }
}));
`;

const manifestPlugin = (): string => `import { createHash } from 'node:crypto';
import { readdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

import { runnerImport } from 'vite';

import type { Plugin, ResolvedConfig } from 'vite';

type DeclarationsModule = typeof import('../src/declarations');

/** One file of the build as a page loads it: its name, what it is, and the hash the browser checks it against. */
interface ManifestAsset {
  src: string;
  type: 'script' | 'style';
  integrity: string;
  isMain: boolean;
}

const integrityOf = async (file: string): Promise<string> => {
  const content = await readFile(file);
  const hash = createHash('sha384').update(content).digest('base64');

  return \`sha384-\${hash}\`;
};

/** One built file, as the manifest lists it. Every file the build writes is the plugin's, so each one is loaded. */
const assetIn =
  (outDir: string) =>
  async (file: string): Promise<[string, ManifestAsset]> => [
    file,
    {
      src: file,
      type: file.endsWith('.css') ? 'style' : 'script',
      integrity: await integrityOf(path.join(outDir, file)),
      isMain: true
    }
  ];

/**
 * Writes \`plugin-manifest.json\` beside the build.
 *
 * The builder lists the plugin from it, the page server finds the code to load through it, and the MCP server
 * describes each element to an agent with it — all before anything loads the code. It is written from the elements'
 * declarations and the files the build actually produced, so it can only describe what is there.
 */
export const manifest = ({ version }: { version: string }): Plugin => {
  let root = '';
  let outDir = '';

  return {
    name: 'plitzi-plugin-manifest',
    apply: 'build',
    configResolved(config: ResolvedConfig) {
      root = config.root;
      outDir = path.resolve(config.root, config.build.outDir);
    },
    async closeBundle() {
      const built = (await readdir(outDir)).filter(file => file.endsWith('.mjs') || file.endsWith('.css')).sort();
      const assets = Object.fromEntries(await Promise.all(built.map(assetIn(outDir))));
      // Loaded through Vite, the way the build read them, rather than imported by this config: what the config imports
      // is loaded by Node alone, which knows nothing of the extensionless imports the source is written with.
      const { module } = await runnerImport<DeclarationsModule>(path.join(root, 'src/declarations.ts'), {
        configFile: false,
        logLevel: 'silent'
      });
      const { declarations } = module;
      const [main] = declarations;
      const { definition, market } = main.content;

      const content = {
        root: main.type,
        version,
        author: market.owner,
        definition: { name: definition.label, description: definition.description, ...market, verified: false },
        pluginSchema: Object.fromEntries(
          declarations.map(({ type, content: { attributes, definition, builder, defaultStyle } }) => [
            type,
            { attributes, definition, builder, defaultStyle }
          ])
        ),
        assets,
        assetsSettings: {}
      };
      await writeFile(path.join(outDir, 'plugin-manifest.json'), \`\${JSON.stringify(content, null, 2)}\\n\`);
    }
  };
};
`;

const zipScript = (): string => `import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

import { zipSync } from 'fflate';

/**
 * The build as the builder takes it: a zip with \`plugin-manifest.json\` at its root.
 *
 * Upload it in the builder under Resources, as a plugin. The platform unpacks it at an address of its own, and that
 * address is the plugin's \`resource\` — what a space lists to load it.
 */
const DIST = 'dist';

const { name, version } = JSON.parse(readFileSync('package.json', 'utf-8')) as { name: string; version: string };
// The files the page loads. The type declarations in \`types/\` are for a project installing the package, not for a page.
const files = readdirSync(DIST, { withFileTypes: true })
  .filter(entry => entry.isFile())
  .map(entry => entry.name);
if (!files.includes('plugin-manifest.json')) {
  throw new Error(\`\${DIST}/ has no plugin-manifest.json — build the plugin first.\`);
}

const out = \`\${name.replace(/^@[^/]+\\//, '')}-\${version}.zip\`;
writeFileSync(out, zipSync(Object.fromEntries(files.map(file => [file, readFileSync(path.join(DIST, file))]))));
console.log(out);
`;

export const buildFiles = (names: PluginNames): ProjectFiles => ({
  'vite.config.ts': viteConfig(names),
  'build/manifest.ts': manifestPlugin(),
  'build/zip.ts': zipScript()
});
