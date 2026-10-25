import fs from 'node:fs/promises';
import path from 'node:path';

import { loadTypeScript } from '../projectTypeScript';

import type TypeScript from 'typescript';

/**
 * What a task's files import from the rest of the project, as their brief says it: each name they import, its
 * signature and the first sentence of its doc — never its body. Every agent of a run read the same shared modules whole
 * to learn how to call them (`theme.ts`, `sectionHeading.ts`, the components' `index.ts`, a dozen times
 * each across the run); the names a file imports, and how they are called, are what it needs of them.
 */
export interface ImportedApi {
  /** The module, by its project path. */
  file: string;
  /** One line a name: `sectionHeading(id: string, title: string): ElementSpec — A section's heading, …`. */
  names: string[];
}

type Ts = typeof TypeScript;

/** A signature shown whole up to this; past it, cut. */
const MAX_LINE = 200;

const SOURCE_EXTENSIONS = ['', '.ts', '.tsx', '/index.ts', '/index.tsx'];

const exists = (file: string): Promise<boolean> =>
  fs.stat(file).then(
    stat => stat.isFile(),
    () => false
  );

/** The project path a relative import names, as the bundler resolves it — or nothing for one that is not source. */
const resolved = async (root: string, from: string, specifier: string): Promise<string | undefined> => {
  if (!specifier.startsWith('.') || /\.(json|css|scss|svg|png|jpe?g|webp)$/.test(specifier)) {
    return undefined;
  }

  const base = path.posix.normalize(path.posix.join(path.posix.dirname(from), specifier));
  for (const extension of SOURCE_EXTENSIONS) {
    if (await exists(path.join(root, `${base}${extension}`))) {
      return `${base}${extension}`;
    }
  }

  return undefined;
};

const oneLine = (text: string): string => {
  const line = text.replace(/\s+/g, ' ').trim();

  return line.length > MAX_LINE ? `${line.slice(0, MAX_LINE - 1)}…` : line;
};

/** The first sentence of the doc comment just above `node`. */
const docOf = (ts: Ts, source: TypeScript.SourceFile, node: TypeScript.Node): string => {
  const ranges = ts.getLeadingCommentRanges(source.text, node.getFullStart()) ?? [];
  const doc = ranges
    .map(range => source.text.slice(range.pos, range.end))
    .filter(text => text.startsWith('/**'))
    .at(-1);
  if (!doc) {
    return '';
  }

  const words = doc
    .replace(/^\/\*\*|\*\/$/g, '')
    .split('\n')
    .map(line => line.replace(/^\s*\*\s?/, ''))
    .join(' ');
  const sentence = /^(.*?\.)(\s|$)/.exec(words.trim())?.[1] ?? words.trim();

  return oneLine(sentence);
};

const parameters = (source: TypeScript.SourceFile, node: TypeScript.SignatureDeclarationBase): string =>
  `(${node.parameters.map(parameter => parameter.getText(source)).join(', ')})${node.type ? `: ${node.type.getText(source)}` : ''}`;

/** How `name` is called or what it is, as its declaration says it — without the body. */
const signatureOf = (ts: Ts, source: TypeScript.SourceFile, node: TypeScript.Node, name: string): string => {
  if (ts.isFunctionDeclaration(node)) {
    return `${name}${parameters(source, node)}`;
  }

  if (ts.isVariableDeclaration(node)) {
    const { initializer } = node;
    if (node.type) {
      return `${name}: ${node.type.getText(source)}`;
    }

    if (initializer && (ts.isArrowFunction(initializer) || ts.isFunctionExpression(initializer))) {
      return `${name}${parameters(source, initializer)}`;
    }

    // A class made with `styles('card', …)` and the like: the call that makes it is what it is.
    if (initializer && ts.isCallExpression(initializer)) {
      const first = initializer.arguments.at(0);

      return `${name} = ${initializer.expression.getText(source)}(${first ? first.getText(source) : ''}${initializer.arguments.length > 1 ? ', …' : ''})`;
    }

    return `${name} = ${initializer ? initializer.getText(source) : '…'}`;
  }

  if (ts.isInterfaceDeclaration(node)) {
    const members = node.members.flatMap(member =>
      member.name ? [`${member.name.getText(source)}${member.questionToken ? '?' : ''}`] : []
    );

    return `interface ${name} { ${members.join('; ')} }`;
  }

  if (ts.isTypeAliasDeclaration(node)) {
    return `type ${name} = ${node.type.getText(source)}`;
  }

  return name;
};

interface Declared {
  node: TypeScript.Node;
  source: TypeScript.SourceFile;
  statement: TypeScript.Node;
}

/** Each name a module exports, by its declaration — and the modules it passes names on from (`export { x } from`). */
const exportsOf = (
  ts: Ts,
  source: TypeScript.SourceFile
): { declared: Map<string, Declared>; passed: Map<string, { from: string; as: string }> } => {
  const declared = new Map<string, Declared>();
  const passed = new Map<string, { from: string; as: string }>();
  const exported = (node: TypeScript.Node): boolean =>
    ts.canHaveModifiers(node) && (ts.getModifiers(node) ?? []).some(each => each.kind === ts.SyntaxKind.ExportKeyword);
  for (const statement of source.statements) {
    if (ts.isVariableStatement(statement) && exported(statement)) {
      for (const each of statement.declarationList.declarations) {
        if (ts.isIdentifier(each.name)) {
          declared.set(each.name.text, { node: each, source, statement });
        }
      }
    } else if (
      (ts.isFunctionDeclaration(statement) ||
        ts.isInterfaceDeclaration(statement) ||
        ts.isTypeAliasDeclaration(statement)) &&
      statement.name &&
      exported(statement)
    ) {
      declared.set(statement.name.text, { node: statement, source, statement });
    } else if (
      ts.isExportDeclaration(statement) &&
      statement.moduleSpecifier &&
      ts.isStringLiteral(statement.moduleSpecifier) &&
      statement.exportClause &&
      ts.isNamedExports(statement.exportClause)
    ) {
      for (const element of statement.exportClause.elements) {
        passed.set(element.name.text, {
          from: statement.moduleSpecifier.text,
          as: (element.propertyName ?? element.name).text
        });
      }
    }
  }

  return { declared, passed };
};

/** The names a file imports from each module of the project, by the module's project path. */
const importsOf = async (
  ts: Ts,
  root: string,
  file: string,
  text: string
): Promise<Map<string, Set<string> | 'all'>> => {
  const source = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true);
  const wanted = new Map<string, Set<string> | 'all'>();
  for (const statement of source.statements) {
    if (!ts.isImportDeclaration(statement) || !ts.isStringLiteral(statement.moduleSpecifier)) {
      continue;
    }

    const module = await resolved(root, file, statement.moduleSpecifier.text);
    const clause = statement.importClause;
    if (!module || !clause || clause.isTypeOnly) {
      continue;
    }

    const bindings = clause.namedBindings;
    if (clause.name || (bindings && ts.isNamespaceImport(bindings))) {
      wanted.set(module, 'all');
    } else if (bindings && ts.isNamedImports(bindings)) {
      const names = wanted.get(module);
      if (names !== 'all') {
        const set = names ?? new Set<string>();
        bindings.elements
          .filter(element => !element.isTypeOnly)
          .forEach(element => set.add((element.propertyName ?? element.name).text));
        wanted.set(module, set);
      }
    }
  }

  return wanted;
};

/**
 * What `files` (the task's, with their text) import from the project's other modules: each name, its signature, the
 * first sentence of its doc. A barrel's names (`components/index.ts`) are followed to where they are declared. A
 * project with no TypeScript of its own says nothing.
 */
export const importedApis = async (
  root: string,
  files: readonly { file: string; text?: string }[]
): Promise<ImportedApi[]> => {
  const ts = loadTypeScript(root);
  if (!ts) {
    return [];
  }

  const own = new Set(files.map(each => each.file));
  const wanted = new Map<string, Set<string> | 'all'>();
  for (const { file, text } of files) {
    if (text === undefined || !/\.(ts|tsx)$/.test(file)) {
      continue;
    }

    for (const [module, names] of await importsOf(ts, root, file, text)) {
      if (own.has(module)) {
        continue;
      }

      const before = wanted.get(module);
      wanted.set(module, before === 'all' || names === 'all' ? 'all' : new Set([...(before ?? []), ...names]));
    }
  }

  const parsed = new Map<string, ReturnType<typeof exportsOf> & { source: TypeScript.SourceFile }>();
  const read = async (module: string) => {
    const known = parsed.get(module);
    if (known) {
      return known;
    }

    const text = await fs.readFile(path.join(root, module), 'utf-8').catch(() => undefined);
    if (text === undefined) {
      return undefined;
    }

    const source = ts.createSourceFile(module, text, ts.ScriptTarget.Latest, true);
    const found = { ...exportsOf(ts, source), source };
    parsed.set(module, found);

    return found;
  };

  /** `name` as `module` exports it, followed through the modules that pass it on — three at most. */
  const lineOf = async (module: string, name: string, depth = 0): Promise<string | undefined> => {
    const found = await read(module);
    const own = found?.declared.get(name);
    if (own) {
      const doc = docOf(ts, own.source, own.statement);

      return oneLine(`${signatureOf(ts, own.source, own.node, name)}${doc ? ` — ${doc}` : ''}`);
    }

    const passed = found?.passed.get(name);
    const next = passed && depth < 3 ? await resolved(root, module, passed.from) : undefined;

    return next && passed ? lineOf(next, passed.as, depth + 1) : undefined;
  };

  const apis: ImportedApi[] = [];
  for (const [module, names] of [...wanted].sort(([a], [b]) => a.localeCompare(b))) {
    const found = await read(module);
    const all = names === 'all' ? [...(found?.declared.keys() ?? []), ...(found?.passed.keys() ?? [])] : [...names];
    const lines = (await Promise.all(all.sort().map(name => lineOf(module, name)))).filter(
      (line): line is string => line !== undefined
    );
    if (lines.length > 0) {
      apis.push({ file: module, names: lines });
    }
  }

  return apis;
};
