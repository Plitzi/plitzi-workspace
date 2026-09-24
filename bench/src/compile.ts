import path from 'node:path';

import { run } from './runtime/process';

/**
 * Emits TypeScript as JavaScript with the workspace's compiler, for what the bench runs inside a server — so no
 * TypeScript transformer is loaded into a process being measured. The bench's own tsconfig type-checks these files;
 * this only emits them.
 */
export const emitTypeScript = async (
  workspaceRoot: string,
  entries: string[],
  outDir: string,
  rootDir?: string
): Promise<void> => {
  await run('node', [
    path.join(workspaceRoot, 'node_modules/typescript/bin/tsc'),
    ...entries.map(entry => path.join(workspaceRoot, entry)),
    '--ignoreConfig',
    '--outDir',
    path.join(workspaceRoot, outDir),
    ...(rootDir ? ['--rootDir', path.join(workspaceRoot, rootDir)] : []),
    '--module',
    'esnext',
    '--moduleResolution',
    'bundler',
    '--target',
    'es2023',
    '--types',
    'node',
    '--allowImportingTsExtensions',
    '--rewriteRelativeImportExtensions',
    '--skipLibCheck'
  ]);
};
