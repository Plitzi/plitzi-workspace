import fs from 'node:fs/promises';
import path from 'node:path';

import { isRecord } from '@plitzi/sdk-shared/helpers';

import { loadTypeScript } from '../../projectTypeScript';

import type { Migration, MigrationEdit, MigrationPlace } from '../types';
import type TypeScript from 'typescript';

const readText = async (file: string): Promise<string | undefined> => {
  try {
    return await fs.readFile(file, 'utf-8');
  } catch {
    return undefined;
  }
};

const exists = (file: string): Promise<boolean> =>
  fs.stat(file).then(
    stat => stat.isFile(),
    () => false
  );

/** Whether the installed package exports its folders (`"./*"`) — the shape that has no entry for a single file. */
const exportsFolders = async (root: string, name: string): Promise<boolean> => {
  const manifest = await readText(path.join(root, 'node_modules', name, 'package.json'));
  if (manifest === undefined) {
    return false;
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(manifest);
  } catch {
    // A manifest that does not parse is the install's problem to say, not this check's: nothing is claimed of it.
    return false;
  }

  return isRecord(parsed) && isRecord(parsed.exports) && './*' in parsed.exports;
};

/** One file a project imports by itself: the package, the file in it, and the folder it is imported from now. */
type FileImport = { name: string; subpath: string; folder: string };

const SPECIFIER = /^(@plitzi\/[a-z0-9-]+)\/([A-Za-z0-9_./-]+)$/;
const QUOTED = /['"](@plitzi\/[a-z0-9-]+\/[A-Za-z0-9_./-]+)['"]/g;

/**
 * The names a folder gives what one of its files exports, read off the installed declarations with the project's own
 * TypeScript: the file's export and the folder's are the same symbol once every re-export is followed.
 */
const folderNames = (ts: typeof TypeScript, root: string) => {
  const dist = (name: string, ...parts: string[]) => path.join(root, 'node_modules', name, 'dist', ...parts);
  const known = new Map<string, Map<string, string[]> | undefined>();
  // One program a package, over every declaration it installs: built once, the first time one of its files is met.
  const programs = new Map<string, TypeScript.Program>();
  const programOf = (name: string): TypeScript.Program => {
    let program = programs.get(name);
    if (!program) {
      program = ts.createProgram(ts.sys.readDirectory(dist(name), ['.d.ts']), {
        noEmit: true,
        skipLibCheck: true,
        types: [],
        module: ts.ModuleKind.ESNext,
        moduleResolution: ts.ModuleResolutionKind.Bundler
      });
      programs.set(name, program);
    }

    return program;
  };

  /**
   * For each export of the file, the names the folder exports it under — undefined when the declarations are not
   * there to read.
   */
  return ({ name, subpath, folder }: FileImport): Map<string, string[]> | undefined => {
    const key = `${name}/${subpath}`;
    if (known.has(key)) {
      return known.get(key);
    }

    const fileEntry = dist(name, `${subpath}.d.ts`);
    const folderEntry = dist(name, ...(folder === '.' ? [] : [folder]), 'index.d.ts');
    const program = programOf(name);
    const checker = program.getTypeChecker();
    const moduleOf = (file: string) => {
      const source = program.getSourceFile(file);

      return source ? checker.getSymbolAtLocation(source) : undefined;
    };
    const fileModule = moduleOf(fileEntry);
    const folderModule = moduleOf(folderEntry);
    if (!fileModule || !folderModule) {
      known.set(key, undefined);

      return undefined;
    }

    const target = (symbol: TypeScript.Symbol): TypeScript.Symbol =>
      symbol.flags & ts.SymbolFlags.Alias ? checker.getAliasedSymbol(symbol) : symbol;
    const folderExports = checker
      .getExportsOfModule(folderModule)
      .filter(symbol => symbol.name !== 'default')
      .map(symbol => ({ name: symbol.name, target: target(symbol) }));
    const names = new Map(
      checker.getExportsOfModule(fileModule).map(symbol => {
        const own = target(symbol);

        return [symbol.name, folderExports.filter(each => each.target === own).map(each => each.name)] as const;
      })
    );
    known.set(key, names);

    return names;
  };
};

/**
 * The one name the folder gives `imported` of the file — its own name when the folder keeps it, the file's name for its
 * default — or why there is none to choose.
 */
const nameIn = (
  names: Map<string, string[]>,
  imported: string,
  { subpath }: FileImport
): { name: string } | { why: string } => {
  const candidates = names.get(imported);
  if (!candidates) {
    return { why: `the file exports no \`${imported}\`` };
  }

  const base = path.posix.basename(subpath);
  const chosen =
    candidates.length === 1
      ? candidates[0]
      : candidates.find(candidate => candidate === (imported === 'default' ? base : imported));
  if (chosen === undefined) {
    return {
      why:
        candidates.length === 0
          ? `the folder exports no name for its \`${imported}\``
          : `the folder exports its \`${imported}\` as ${candidates.map(each => `\`${each}\``).join(' and ')}`
    };
  }

  return { name: chosen };
};

const renamed = (exported: string, local: string, typeOnly: boolean): string =>
  `${typeOnly ? 'type ' : ''}${exported === local ? local : `${exported} as ${local}`}`;

/**
 * The declaration written against the folder, when every name it takes has one there — or why it is the author's to
 * change.
 */
const rewriteDeclaration = (
  ts: typeof TypeScript,
  statement: TypeScript.ImportDeclaration | TypeScript.ExportDeclaration,
  source: TypeScript.SourceFile,
  names: Map<string, string[]>,
  target: FileImport,
  quote: string
): { edit: MigrationEdit } | { why: string } => {
  const specifiers: string[] = [];
  const add = (imported: string, local: string, typeOnly: boolean): string | undefined => {
    const found = nameIn(names, imported, target);
    if ('why' in found) {
      return found.why;
    }

    specifiers.push(renamed(found.name, local, typeOnly));

    return undefined;
  };

  let head: string;
  if (ts.isImportDeclaration(statement)) {
    const clause = statement.importClause;
    if (!clause) {
      return { why: 'an import for its effect alone: the folder runs more than the file did' };
    }

    if (clause.namedBindings && ts.isNamespaceImport(clause.namedBindings)) {
      return { why: 'a namespace import: the folder holds more than the file did' };
    }

    if (clause.name) {
      const why = add('default', clause.name.text, false);
      if (why) {
        return { why };
      }
    }

    for (const element of clause.namedBindings?.elements ?? []) {
      const why = add(element.propertyName?.text ?? element.name.text, element.name.text, element.isTypeOnly);
      if (why) {
        return { why };
      }
    }

    head = clause.isTypeOnly ? 'import type' : 'import';
  } else {
    if (!statement.exportClause || !ts.isNamedExports(statement.exportClause)) {
      return { why: 'it re-exports the whole file: the folder holds more than the file did' };
    }

    for (const element of statement.exportClause.elements) {
      const why = add(element.propertyName?.text ?? element.name.text, element.name.text, element.isTypeOnly);
      if (why) {
        return { why };
      }
    }

    head = statement.isTypeOnly ? 'export type' : 'export';
  }

  const original = statement.getText(source);
  const folderSpecifier = target.folder === '.' ? target.name : `${target.name}/${target.folder}`;

  return {
    edit: {
      start: statement.getStart(source),
      end: statement.getEnd(),
      text: `${head} { ${specifiers.join(', ')} } from ${quote}${folderSpecifier}${quote}${original.endsWith(';') ? ';' : ''}`
    }
  };
};

/**
 * A library package is imported by its root and its folders, never by a file: an import of one FILE —
 * `@plitzi/sdk-shared/helpers/isRecord` — is one the installed version no longer answers, imported from its folder
 * (`@plitzi/sdk-shared/helpers`), a default export by the name the folder gives it.
 *
 * Written when the answer is one: an `import` or `export … from` whose every name the folder exports under one name —
 * read off the installed declarations with the project's TypeScript, never guessed (`import usePlitzi from
 * '…/hooks/usePlitzi'` → `import { usePlitzi } from '@plitzi/sdk-shared/hooks'`). Said otherwise, with why: a namespace
 * import, an `import()`, a name the folder does not export or exports twice, a project with no TypeScript. Checked
 * against what is installed, so a package still on its old shape says nothing.
 */
export const folderImports: Migration = {
  id: 'folderImports',
  since: '0.38.17',
  scope: 'always',
  start: ({ root }) => {
    const folders = new Map<string, Promise<boolean>>();
    const ts = loadTypeScript(root);
    const namesOf = ts ? folderNames(ts, root) : undefined;

    /** The file `specifier` imports by itself, when it is one in a package that exports its folders. */
    const fileImport = async (specifier: string): Promise<FileImport | undefined> => {
      const match = SPECIFIER.exec(specifier);
      if (!match) {
        return undefined;
      }

      const [, name, subpath] = match;
      if (!folders.has(name)) {
        folders.set(name, exportsFolders(root, name));
      }

      if (
        !(await folders.get(name)) ||
        (await exists(path.join(root, 'node_modules', name, 'dist', subpath, 'index.d.ts')))
      ) {
        return undefined;
      }

      return { name, subpath, folder: path.posix.dirname(subpath) };
    };

    const what = ({ name, folder }: FileImport, why?: string): string =>
      `import it from \`${folder === '.' ? name : `${name}/${folder}`}\` — a package is imported by its root and its folders, a default export by the name the folder gives it${why ? ` (${why})` : ''}`;

    return async ({ file, text }) => {
      const places: MigrationPlace[] = [];
      const lineOf = (offset: number): number => text.slice(0, offset).split('\n').length;
      const declared = new Set<number>();

      if (ts && namesOf) {
        const source = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true);
        for (const statement of source.statements) {
          if (
            !(ts.isImportDeclaration(statement) || ts.isExportDeclaration(statement)) ||
            !statement.moduleSpecifier ||
            !ts.isStringLiteral(statement.moduleSpecifier)
          ) {
            continue;
          }

          const target = await fileImport(statement.moduleSpecifier.text);
          if (!target) {
            continue;
          }

          const at = statement.moduleSpecifier.getStart(source);
          declared.add(at);
          const names = namesOf(target);
          const result = names
            ? rewriteDeclaration(ts, statement, source, names, target, text[at])
            : { why: `${target.name} installs no declarations for \`${target.subpath}\` to read its names from` };
          places.push(
            'edit' in result
              ? { line: lineOf(statement.getStart(source)), what: what(target), edit: result.edit }
              : { line: lineOf(statement.getStart(source)), what: what(target, result.why) }
          );
        }
      }

      // What no declaration took: an `import()`, a mock, a string — or every one, in a project with no TypeScript.
      for (const match of text.matchAll(QUOTED)) {
        if (declared.has(match.index)) {
          continue;
        }

        const target = await fileImport(match[1]);
        if (target) {
          places.push({
            line: lineOf(match.index),
            what: what(
              target,
              ts ? 'not an `import` or `export … from`' : 'the project installs no TypeScript to read the names with'
            )
          });
        }
      }

      return places.sort((a, b) => a.line - b.line);
    };
  }
};
