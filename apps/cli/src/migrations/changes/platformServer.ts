import { loadTypeScript } from '../../projectTypeScript';

import type { Migration, MigrationPlace } from '../types';
import type TypeScript from 'typescript';

/** What a page server is no longer configured with: the actions engine's own configuration (docs/en/server-packages.md, D12). */
const ENGINE_KEYS = new Set(['action', 'functions', 'connectors', 'realtime']);

const SERVER = '@plitzi/sdk-server';
const PLATFORM = '@plitzi/sdk-server/platform';

/** The named import of `createServer` from the page server, by the name the file calls it. */
const serverImport = (
  ts: typeof TypeScript,
  source: TypeScript.SourceFile
): { statement: TypeScript.ImportDeclaration; local: string; named: TypeScript.NamedImports } | undefined => {
  for (const statement of source.statements) {
    if (
      !ts.isImportDeclaration(statement) ||
      !ts.isStringLiteral(statement.moduleSpecifier) ||
      statement.moduleSpecifier.text !== SERVER ||
      statement.importClause?.isTypeOnly
    ) {
      continue;
    }

    const named = statement.importClause?.namedBindings;
    const element =
      named && ts.isNamedImports(named)
        ? named.elements.find(each => (each.propertyName ?? each.name).text === 'createServer')
        : undefined;
    if (named && ts.isNamedImports(named) && element) {
      return { statement, local: element.name.text, named };
    }
  }

  return undefined;
};

/**
 * `createServer` serves pages and refuses the actions engine's configuration: a call that hands it `action`,
 * `functions`, `connectors` or `realtime` is `createPlatform` (`@plitzi/sdk-server/platform`), which builds the engine and
 * hands it to the page server. Written: the call renamed and the import added — `createServer` kept where the file
 * still calls it for pages alone. A call whose configuration is not written out where it is made is said, never
 * written.
 */
export const platformServer: Migration = {
  id: 'platformServer',
  since: '0.39.2',
  scope: 'always',
  start: ({ root }) => {
    const ts = loadTypeScript(root);

    return ({ file, text }) => {
      if (!text.includes(SERVER) || !text.includes('createServer')) {
        return Promise.resolve([]);
      }

      const lineOf = (offset: number): number => text.slice(0, offset).split('\n').length;
      if (!ts) {
        return Promise.resolve(
          [...text.matchAll(/\bcreateServer\(/g)].map(match => ({
            line: lineOf(match.index),
            what: `createServer given the actions engine's configuration is createPlatform (${PLATFORM}) now — read without TypeScript, so not written`
          }))
        );
      }

      const source = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true);
      const imported = serverImport(ts, source);
      if (!imported) {
        return Promise.resolve([]);
      }

      const places: MigrationPlace[] = [];
      let pagesOnly = false;
      const visit = (node: TypeScript.Node): void => {
        if (ts.isCallExpression(node) && ts.isIdentifier(node.expression) && node.expression.text === imported.local) {
          const config = node.arguments.at(0);
          const engineKeys =
            config && ts.isObjectLiteralExpression(config)
              ? config.properties.filter(
                  property =>
                    property.name !== undefined &&
                    (ts.isIdentifier(property.name) || ts.isStringLiteral(property.name)) &&
                    ENGINE_KEYS.has(property.name.text)
                )
              : [];
          const spreads =
            config && ts.isObjectLiteralExpression(config) && config.properties.some(ts.isSpreadAssignment);
          if (engineKeys.length > 0) {
            places.push({
              line: lineOf(node.getStart(source)),
              what: `createServer is given ${engineKeys.map(key => key.name?.getText(source)).join(', ')}: createPlatform (${PLATFORM}) builds the engine from them`,
              edit: { start: node.expression.getStart(source), end: node.expression.getEnd(), text: 'createPlatform' }
            });
          } else if (config && (!ts.isObjectLiteralExpression(config) || spreads)) {
            places.push({
              line: lineOf(node.getStart(source)),
              what: `createServer refuses the actions engine's configuration — if this one carries action, functions, connectors or realtime, it is createPlatform (${PLATFORM})`
            });
            pagesOnly = true;
          } else {
            pagesOnly = true;
          }
        }

        ts.forEachChild(node, visit);
      };
      visit(source);

      if (!places.some(place => place.edit)) {
        return Promise.resolve(places);
      }

      // The import the renamed calls need, beside the one they had — which goes when nothing calls it any more.
      const { statement, named } = imported;
      const quote = text[statement.moduleSpecifier.getStart(source)];
      const semicolon = statement.getText(source).endsWith(';') ? ';' : '';
      const kept = named.elements.filter(
        element => pagesOnly || (element.propertyName ?? element.name).text !== 'createServer'
      );
      const clause = statement.importClause;
      const own = [
        clause?.name?.text,
        kept.length > 0 ? `{ ${kept.map(element => element.getText(source)).join(', ')} }` : undefined
      ]
        .filter(Boolean)
        .join(', ');
      const lines = [
        ...(own ? [`import ${own} from ${quote}${SERVER}${quote}${semicolon}`] : []),
        `import { createPlatform } from ${quote}${PLATFORM}${quote}${semicolon}`
      ];
      places.push({
        line: lineOf(statement.getStart(source)),
        what: `createPlatform is imported from \`${PLATFORM}\``,
        edit: { start: statement.getStart(source), end: statement.getEnd(), text: lines.join('\n') }
      });

      return Promise.resolve(places);
    };
  }
};
