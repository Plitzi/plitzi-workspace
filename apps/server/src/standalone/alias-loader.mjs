import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { transform } from 'esbuild';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ajusta esto a tu root
const root = path.resolve(process.cwd());

const packages = {
  '@plitzi/sdk-auth': path.join(root, '../../packages/sdk-auth/src'),
  '@plitzi/sdk-dev-tools': path.join(root, '../../packages/sdk-dev-tools/src'),
  '@plitzi/sdk-elements': path.join(root, '../../packages/sdk-elements/src'),
  '@plitzi/sdk-event-bridge': path.join(root, '../../packages/sdk-event-bridge/src'),
  '@plitzi/sdk-interactions': path.join(root, '../../packages/sdk-interactions/src'),
  '@plitzi/sdk-navigation': path.join(root, '../../packages/sdk-navigation/src'),
  '@plitzi/sdk-plugins': path.join(root, '../../packages/sdk-plugins/src'),
  '@plitzi/sdk-schema': path.join(root, '../../packages/sdk-schema/src'),
  '@plitzi/sdk-shared': path.join(root, '../../packages/sdk-shared/src'),
  '@plitzi/sdk-style': path.join(root, '../../packages/sdk-style/src'),
  '@plitzi/sdk-variables': path.join(root, '../../packages/sdk-variables/src'),
  '@plitzi/nexus': path.join(root, '../../packages/nexus/src'),
  '@plitzi/plitzi-sdk': path.join(root, '../sdk/src'),
  '@plitzi/plitzi-builder': path.join(root, '../builder/src'),
  // '@plitzi/plitzi-ui': path.join(root, '../../../plitzi-ui/src')
  // alias
  '@modules': path.join(root, '../sdk/src/modules')
};

// Third-party modules replaced by local stubs in this source-loading dev mode — they rely on CJS/ESM
// interop or top-level side effects that break under the ESM loader (and aren't needed for SSR dev).
const stubs = {
  'react-syntax-highlighter': path.join(__dirname, 'stubs/react-syntax-highlighter.mjs')
};

const DEBUG = process.env.ALIAS_LOADER_DEBUG === '1';

const debug = (msg, data) => {
  if (!DEBUG) {
    return;
  }

  fs.writeSync(1, `[alias-loader] ${msg} ${data ? JSON.stringify(data) : ''}\n`);
};

debug('resolve:root', root);

function isFile(p) {
  try {
    return fs.existsSync(p) && fs.statSync(p).isFile();
  } catch {
    return false;
  }
}

function getDirFromSpecifier(specifier) {
  if (specifier.startsWith('file://')) {
    return path.dirname(fileURLToPath(specifier));
  }

  // relative imports

  if (specifier.startsWith('./') || specifier.startsWith('../')) {
    return path.dirname(path.resolve(specifier));
  }

  // package imports → NO folder concept exists here

  return null;
}

function resolveWithExtensions(filePath) {
  if (/\.(js|mjs|jsx|ts|tsx)$/.test(filePath)) {
    const dir = getDirFromSpecifier(filePath);
    // Bare package specifiers (e.g. '@scope/pkg/sub.js') have no folder concept here — leave them
    // untouched so Node's default resolver handles them instead of crashing on path.join(null, …).
    if (!dir) {
      return filePath;
    }

    filePath = dir;
  }

  const candidates = [
    path.join(filePath, 'index.ts'),
    path.join(filePath, 'index.tsx'),
    path.join(filePath, 'index.js'),
    path.join(filePath, 'index.mjs'),
    path.join(filePath, 'index.jsx'),
    filePath + '.ts',
    filePath + '.tsx',
    filePath + '.js',
    filePath + '.mjs',
    filePath + '.jsx',
    filePath
  ];

  for (const candidate of candidates) {
    if (isFile(candidate)) {
      return candidate;
    }
  }

  return filePath; // fallback
}

export async function resolve(specifier, context, defaultResolve) {
  // Strip Vite-style query suffixes (e.g. '?url', '?inline') so style assets are matched regardless.
  const specifierPath = specifier.split('?')[0];

  if (specifierPath in stubs) {
    return { url: pathToFileURL(stubs[specifierPath]).href, shortCircuit: true };
  }

  if (specifierPath.endsWith('.scss') || specifierPath.endsWith('.css')) {
    // Node re-appends the original query (e.g. '?url') to the resolved URL, so end the module body with a
    // line comment to keep it valid JS no matter what gets tacked on.
    return {
      url: 'data:text/javascript,export default ""//',
      shortCircuit: true
    };
  }

  debug('=====================', specifier);
  debug('resolve:start', specifier);

  for (const key in packages) {
    if (specifier === key || specifier.startsWith(key + '/')) {
      debug('alias:match', { specifier, key });
      const subPath = specifier.slice(key.length);
      debug('alias:subPath', subPath);
      const rawPath = subPath ? path.join(packages[key], subPath) : packages[key];
      debug('alias:rawPath', rawPath);
      const resolvedPath = resolveWithExtensions(rawPath);
      debug('alias:resolvedPath', resolvedPath);
      debug('alias:attempt', { specifier, resolvedPath });
      debug('alias:existsCheck', isFile(resolvedPath));
      if (isFile(resolvedPath)) {
        debug('alias:hit', resolvedPath);

        return { url: pathToFileURL(resolvedPath).href, shortCircuit: true };
      }
    }
  }

  // Relative imports: resolve against the importing module and try TS/JS extensions, since the source
  // graph omits them (Vite/tsx add them at build time).
  if ((specifierPath.startsWith('./') || specifierPath.startsWith('../')) && context.parentURL) {
    const parentDir = path.dirname(fileURLToPath(context.parentURL));
    const resolved = resolveWithExtensions(path.resolve(parentDir, specifierPath));
    if (isFile(resolved)) {
      return { url: pathToFileURL(resolved).href, shortCircuit: true };
    }
  }

  const candidate = resolveWithExtensions(specifier);
  debug('fallback:node', candidate);
  if (isFile(candidate)) {
    return defaultResolve(candidate, context, defaultResolve);
  }

  try {
    return await defaultResolve(specifier, context, defaultResolve);
  } catch (err) {
    // Node ESM rejects directory imports (e.g. a package subpath that points at a folder); Vite would
    // resolve them to an index file, so retry that here before giving up.
    if (err && (err.code === 'ERR_UNSUPPORTED_DIR_IMPORT' || err.code === 'ERR_MODULE_NOT_FOUND') && err.url) {
      const resolved = resolveWithExtensions(fileURLToPath(err.url));
      if (isFile(resolved)) {
        return { url: pathToFileURL(resolved).href, shortCircuit: true };
      }
    }

    throw err;
  }
}

const loaderByExt = {
  '.ts': 'ts',
  '.mts': 'ts',
  '.cts': 'ts',
  '.tsx': 'tsx',
  '.jsx': 'jsx'
};

// Vite injects these at build time; the source graph reads them directly, so define them here for the
// standalone (non-Vite) dev run.
const define = {
  'import.meta.env.PROD': 'false',
  'import.meta.env.DEV': 'true',
  'import.meta.env.MODE': '"development"',
  'import.meta.env.SSR': 'true'
};

export async function load(url, context, nextLoad) {
  if (!url.startsWith('file:')) {
    return nextLoad(url, context);
  }

  const filePath = fileURLToPath(url.split('?')[0]);
  const ext = path.extname(filePath);

  // JSON imports in the source graph omit the `with { type: 'json' }` attribute that Node ESM requires,
  // so turn them into a default-exporting module here.
  if (ext === '.json') {
    return { format: 'module', source: `export default ${fs.readFileSync(filePath, 'utf8')}`, shortCircuit: true };
  }

  const loader = loaderByExt[ext];
  if (!loader) {
    return nextLoad(url, context);
  }

  // tsx does not honour the tsconfig `jsx` setting in this setup, so transform here with esbuild and force
  // the automatic JSX runtime — otherwise source files without an explicit React import throw at runtime.
  const source = fs.readFileSync(filePath, 'utf8');
  const { code } = await transform(source, {
    loader,
    jsx: 'automatic',
    format: 'esm',
    target: 'es2022',
    sourcefile: filePath,
    sourcemap: 'inline',
    define
  });

  return { format: 'module', source: code, shortCircuit: true };
}
