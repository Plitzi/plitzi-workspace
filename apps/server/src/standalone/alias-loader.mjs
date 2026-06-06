import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

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
  '@plitzi/sdk-state': path.join(root, '../../packages/sdk-state/src'),
  '@plitzi/sdk-style': path.join(root, '../../packages/sdk-style/src'),
  '@plitzi/sdk-variables': path.join(root, '../../packages/sdk-variables/src'),
  '@plitzi/sdk-store': path.join(root, '../../packages/sdk-store/src'),
  '@plitzi/plitzi-sdk': path.join(root, '../sdk/src'),
  '@plitzi/plitzi-builder': path.join(root, '../builder/src'),
  // '@plitzi/plitzi-ui': path.join(root, '../../../plitzi-ui/src')
  // alias
  '@modules': path.join(root, '../sdk/src/modules')
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
  if (/\.(js|mjs|jsx|ts|tsx)/.test(filePath)) {
    filePath = getDirFromSpecifier(filePath);
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
  if (specifier.endsWith('.scss') || specifier.endsWith('.css')) {
    return {
      url: 'data:text/javascript,export default {}',
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

  const candidate = resolveWithExtensions(specifier);
  debug('fallback:node', candidate);
  if (isFile(candidate)) {
    return defaultResolve(candidate, context, defaultResolve);
  }

  return defaultResolve(specifier, context, defaultResolve);
}
