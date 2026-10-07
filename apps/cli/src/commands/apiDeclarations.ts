import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

import { isRecord } from '@plitzi/sdk-shared/helpers/isRecord';

import { loadTypeScript } from '../projectTypeScript';

import type TypeScript from 'typescript';

/**
 * Any export of `@plitzi/sdk-authoring` by its name — its signature and what its doc says first — read from the `.d.ts`
 * the project installed, so it is always the version the project runs. What `plitzi explain` answers for a name its
 * catalogues do not hold (`pageFamily`, `styles`, `SpaceSpec`), so an agent never searches the published types — some
 * 180k tokens — for one line.
 */

export interface ApiExplanation {
  kind: 'api';
  name: string;
  /** The first paragraph of its doc, or nothing when it has none. */
  summary: string;
  /** Its declaration as published, cut after `WRITTEN_LINES`. */
  written: string;
}

const PACKAGE = '@plitzi/sdk-authoring';

const WRITTEN_LINES = 14;

/** The `.d.ts` the package installed nearest `root` declares itself typed by. */
const declarationsFile = (root: string): string | undefined => {
  for (let dir = path.resolve(root); ; dir = path.dirname(dir)) {
    const manifest = path.join(dir, 'node_modules', PACKAGE, 'package.json');
    if (existsSync(manifest)) {
      const parsed: unknown = JSON.parse(readFileSync(manifest, 'utf-8'));
      const types = isRecord(parsed) && typeof parsed.types === 'string' ? parsed.types : 'dist/index.d.ts';

      return path.join(path.dirname(manifest), types);
    }

    if (path.dirname(dir) === dir) {
      return undefined;
    }
  }
};

const declaredName = (ts: typeof TypeScript, statement: TypeScript.Statement): string[] => {
  if (ts.isVariableStatement(statement)) {
    return statement.declarationList.declarations.flatMap(declaration =>
      ts.isIdentifier(declaration.name) ? [declaration.name.text] : []
    );
  }

  if (
    (ts.isFunctionDeclaration(statement) ||
      ts.isInterfaceDeclaration(statement) ||
      ts.isTypeAliasDeclaration(statement) ||
      ts.isClassDeclaration(statement) ||
      ts.isEnumDeclaration(statement)) &&
    statement.name
  ) {
    return [statement.name.text];
  }

  return [];
};

/** The first paragraph of the doc comment a statement starts with. */
const summaryOf = (sourceFile: TypeScript.SourceFile, statement: TypeScript.Statement): string => {
  const leading = sourceFile.text.slice(statement.getFullStart(), statement.getStart(sourceFile));
  const doc = /\/\*\*([\s\S]*?)\*\//.exec(leading)?.[1] ?? '';
  const text = doc
    .split('\n')
    .map(line => line.replace(/^\s*\*\s?/, ''))
    .join('\n')
    .trim();

  return (text.split(/\n\s*\n/)[0] ?? '').replace(/\s+/g, ' ').trim();
};

/** The declarations as published — under the name it is imported by, when the bundle declared it under another. */
const writtenOf = (
  sourceFile: TypeScript.SourceFile,
  statements: readonly TypeScript.Statement[],
  local: string,
  name: string
): string => {
  const lines = statements
    .map(statement => sourceFile.text.slice(statement.getStart(sourceFile), statement.getEnd()))
    .join('\n')
    .replace(/^(?:export )?declare /gm, '')
    .replace(new RegExp(`\\b${local}\\b`, 'g'), name)
    .split('\n');

  return lines.length > WRITTEN_LINES ? [...lines.slice(0, WRITTEN_LINES), '    …'].join('\n') : lines.join('\n');
};

export const apiDeclaration = (root: string, name: string): ApiExplanation | undefined => {
  const ts = loadTypeScript(root);
  const file = declarationsFile(root);
  if (!ts || !file || !existsSync(file)) {
    return undefined;
  }

  const sourceFile = ts.createSourceFile(file, readFileSync(file, 'utf-8'), ts.ScriptTarget.Latest, true);
  // A name the bundle published under another (`export { Element_2 as Element }`) is looked up by the one it declares.
  let local = name;
  for (const statement of sourceFile.statements) {
    if (ts.isExportDeclaration(statement) && statement.exportClause && ts.isNamedExports(statement.exportClause)) {
      const alias = statement.exportClause.elements.find(element => element.name.text === name);
      if (alias) {
        local = (alias.propertyName ?? alias.name).text;
      }
    }
  }

  const declarations = sourceFile.statements.filter(statement => declaredName(ts, statement).includes(local));
  if (declarations.length === 0) {
    return undefined;
  }

  return {
    kind: 'api',
    name,
    summary: summaryOf(sourceFile, declarations[0]),
    written: writtenOf(sourceFile, declarations, local, name)
  };
};

export const apiText = (explanation: ApiExplanation): string =>
  [
    `${explanation.name} — export of ${PACKAGE}${explanation.summary ? `: ${explanation.summary}` : ''}`,
    explanation.written
  ].join('\n');
