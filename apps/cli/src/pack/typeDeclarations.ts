import { createRequire } from 'node:module';
import path from 'node:path';

import type TypeScript from 'typescript';

/**
 * A plugin package's type declarations, for a project that installs it and imports its elements.
 *
 * Written with the package's OWN TypeScript and its own `tsconfig.json` — the compiler and the settings its source is
 * checked with — so the declarations describe the code as the package sees it. Only what `src/` holds is emitted, into
 * `types/` beside the build: the preview and the tests are the package's, not its consumers'.
 */

/** What became of the declarations: written, or not, because the package has no TypeScript to write them with. */
export type TypesOutcome = 'written' | 'no-typescript';

const loadTypeScript = (root: string): typeof TypeScript | undefined => {
  try {
    // Resolved from the package, not from the CLI: its version is the one its source is written for. What `require`
    // hands back is the TypeScript module — the type is the one the package's own `import` would see.
    return createRequire(path.join(root, 'package.json'))('typescript') as typeof TypeScript;
  } catch {
    return undefined;
  }
};

export const emitTypeDeclarations = (root: string, outDir: string): TypesOutcome => {
  const ts = loadTypeScript(root);
  if (!ts) {
    return 'no-typescript';
  }

  const configFile = ts.findConfigFile(root, file => ts.sys.fileExists(file));
  // A tsconfig is JSON the compiler parses below; nothing here reads it first.
  const config: unknown = configFile ? ts.readConfigFile(configFile, file => ts.sys.readFile(file)).config : {};
  const parsed = ts.parseJsonConfigFileContent(config, ts.sys, root);
  const source = path.join(root, 'src');
  const files = parsed.fileNames.filter(file => file.startsWith(`${source}${path.sep}`));

  const program = ts.createProgram(files, {
    ...parsed.options,
    noEmit: false,
    declaration: true,
    emitDeclarationOnly: true,
    outDir: path.join(outDir, 'types'),
    rootDir: source
  });
  const { diagnostics } = program.emit();
  if (diagnostics.length > 0) {
    const messages = diagnostics.map(diagnostic => ts.flattenDiagnosticMessageText(diagnostic.messageText, '\n'));
    throw new Error(messages.join('\n'));
  }

  return 'written';
};
