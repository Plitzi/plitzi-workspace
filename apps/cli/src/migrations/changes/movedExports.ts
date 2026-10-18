import { loadTypeScript } from '../../projectTypeScript';

import type { Migration, MigrationPlace } from '../types';
import type TypeScript from 'typescript';

/** An export that left one entry of a package for another, under the same name. */
type Move = { name: string; from: string; to: string };

/** Oldest first; each is `since` this migration's version. */
const DATES = [
  'formatDate',
  'formatDateUTC',
  'formatFromNow',
  'formatUTCToLocal',
  'getDurationMs',
  'isDate',
  'isValidFormat',
  'parseDate',
  'SupportedLocale',
  'toUnixSeconds'
] as const;

const MOVES: readonly Move[] = [
  // A constant the server and the browser's linter read, no longer in a folder of the browser's hooks.
  { name: 'PROJECT_DATA_PREFIX', from: '@plitzi/sdk-shared/server', to: '@plitzi/sdk-shared/project/paths' },
  // Dates load date-fns — a hundred modules — which every import of `helpers` paid for, a server's included.
  ...DATES.map(name => ({ name, from: '@plitzi/sdk-shared/helpers', to: '@plitzi/sdk-shared/dates' })),
  // React's hooks and contexts, apart from the areas a server imports: `<area>/react`, as `@plitzi/nexus/react` is.
  ...(
    [
      ['style', ['useDisplayMode', 'useElementSize', 'ElementSize']],
      ['schema', ['SchemaContext']],
      ['plugins', ['PluginsContext']],
      ['devTools', ['DevToolsContext', 'DevToolsContextValue']],
      ['flags', ['useFlagResolution']]
    ] as const
  ).flatMap(([area, names]) =>
    names.map(name => ({ name, from: `@plitzi/sdk-shared/${area}`, to: `@plitzi/sdk-shared/${area}/react` }))
  )
];

const movedFrom = (from: string, name: string): Move | undefined =>
  MOVES.find(move => move.from === from && move.name === name);

/**
 * An export moved to another entry of its package, under the same name (`MOVES`): an `import { name } from '<from>'`
 * now fails to build. Written: the name imported from where it lives now — the whole declaration when it takes only
 * moved names, the moved names split into an import of their own otherwise. Said, never written, in a project with no
 * TypeScript to read the declarations with.
 */
export const movedExports: Migration = {
  id: 'movedExports',
  since: '0.38.18',
  scope: 'always',
  start: ({ root }) => {
    const ts = loadTypeScript(root);

    return ({ file, text }) => {
      if (!MOVES.some(move => text.includes(move.from))) {
        return Promise.resolve([]);
      }

      const lineOf = (offset: number): number => text.slice(0, offset).split('\n').length;
      if (!ts) {
        return Promise.resolve(
          MOVES.flatMap(move =>
            [...text.matchAll(new RegExp(`\\b${move.name}\\b`, 'g'))].map(match => ({
              line: lineOf(match.index),
              what: `${move.name} is imported from \`${move.to}\` now (the project installs no TypeScript to read the import with)`
            }))
          )
        );
      }

      const source = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true);
      const places: MigrationPlace[] = [];
      for (const statement of source.statements) {
        const place = movedImport(ts, source, statement);
        if (place) {
          places.push({ ...place, line: lineOf(statement.getStart(source)) });
        }
      }

      return Promise.resolve(places);
    };
  }
};

/** The place an import of moved names is, with the declaration as it is written now. */
const movedImport = (
  ts: typeof TypeScript,
  source: TypeScript.SourceFile,
  statement: TypeScript.Statement
): Omit<MigrationPlace, 'line'> | undefined => {
  if (
    !ts.isImportDeclaration(statement) ||
    !ts.isStringLiteral(statement.moduleSpecifier) ||
    !statement.importClause?.namedBindings ||
    !ts.isNamedImports(statement.importClause.namedBindings)
  ) {
    return undefined;
  }

  const from = statement.moduleSpecifier.text;
  const elements = statement.importClause.namedBindings.elements;
  const moved = elements.filter(element => movedFrom(from, (element.propertyName ?? element.name).text));
  if (moved.length === 0) {
    return undefined;
  }

  const clause = statement.importClause;
  const quote = source.text[statement.moduleSpecifier.getStart(source)];
  const head = clause.isTypeOnly ? 'import type' : 'import';
  const semicolon = statement.getText(source).endsWith(';') ? ';' : '';
  const byTarget = new Map<string, string[]>();
  for (const element of moved) {
    const move = movedFrom(from, (element.propertyName ?? element.name).text);
    if (move) {
      byTarget.set(move.to, [...(byTarget.get(move.to) ?? []), element.getText(source)]);
    }
  }

  const kept = elements.filter(element => !moved.includes(element)).map(element => element.getText(source));
  const imports = [...byTarget].map(
    ([to, names]) => `${head} { ${names.join(', ')} } from ${quote}${to}${quote}${semicolon}`
  );
  if (kept.length > 0 || clause.name) {
    const own = [clause.name?.text, kept.length > 0 ? `{ ${kept.join(', ')} }` : undefined].filter(Boolean).join(', ');
    imports.unshift(`${head} ${own} from ${quote}${from}${quote}${semicolon}`);
  }

  const names = moved.map(element => (element.propertyName ?? element.name).text);

  return {
    what: `${names.join(', ')} ${names.length === 1 ? 'is' : 'are'} imported from \`${[...byTarget.keys()].join('`, `')}\` now`,
    edit: { start: statement.getStart(source), end: statement.getEnd(), text: imports.join('\n') }
  };
};
