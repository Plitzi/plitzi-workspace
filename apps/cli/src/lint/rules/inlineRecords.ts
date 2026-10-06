import { eachNode, enclosingNames, endLineOf, isLiteralValue, placeOf, propertyName } from '../ast';
import { finding } from '../catalog';

import type { LintFinding, Rule, SpaceSourceFile } from '../types';
import type TypeScript from 'typescript';

/**
 * A short list in code is the documented way to write a menu or three plans (`items.map(…)`); past this many records,
 * it is a table of data written into a page, which a person edits as data — in the builder, or by `plitzi push`.
 */
export const MIN_RECORDS = 10;

/** What a space declares rather than shows: lists of these are configuration, never rows of content. */
const CONFIGURATION = new Set(['variables', 'fonts', 'flags', 'visitorRoles', 'breakpoints']);

/** A record of data: an object of literal values with at least two fields. */
const isRecordLiteral = (
  ts: typeof TypeScript,
  node: TypeScript.Expression
): node is TypeScript.ObjectLiteralExpression =>
  ts.isObjectLiteralExpression(node) && node.properties.length >= 2 && isLiteralValue(ts, node);

const keysOf = (ts: typeof TypeScript, record: TypeScript.ObjectLiteralExpression): Set<string> =>
  new Set(record.properties.flatMap(property => propertyName(ts, property.name) ?? []));

/** Records of one table: every record shares a field with every other — `id`, `title`, `href`. */
const isTable = (ts: typeof TypeScript, records: readonly TypeScript.ObjectLiteralExpression[]): boolean => {
  const [first, ...rest] = records.map(record => keysOf(ts, record));
  const shared = [...first].filter(key => rest.every(keys => keys.has(key)));

  return shared.length > 0;
};

/** A file name for the data, from what the list is called in the code: `const DISHES = […]` → `dishes`. */
const dataName = (ts: typeof TypeScript, node: TypeScript.Node): string => {
  const name = enclosingNames(ts, node)[0] ?? 'rows';

  return (
    name
      .replace(/([a-z\d])([A-Z])/g, '$1-$2')
      .replace(/[^a-zA-Z\d]+/g, '-')
      .replace(/^-|-$/g, '')
      .toLowerCase() || 'rows'
  );
};

/** What a node is, seen through `as const` and `satisfies`: the expression it is written as part of. */
const outerOf = (ts: typeof TypeScript, node: TypeScript.Node): TypeScript.Node => {
  let at = node;
  while (
    ts.isAsExpression(at.parent) ||
    ts.isSatisfiesExpression(at.parent) ||
    ts.isParenthesizedExpression(at.parent) ||
    ts.isTypeAssertionExpression(at.parent)
  ) {
    at = at.parent;
  }

  return at;
};

const RENDERING = new Set(['map', 'flatMap']);

/** The name an expression ends in: `FEATURES`, `content.FEATURES`. */
const lastName = (ts: typeof TypeScript, node: TypeScript.Expression): string | undefined => {
  if (ts.isIdentifier(node)) {
    return node.text;
  }

  return ts.isPropertyAccessExpression(node) ? node.name.text : undefined;
};

/**
 * The names rows are rendered from anywhere in the space — `FEATURES.map(…)`, `items: FAQ` — with what each is imported
 * as: a list of records is a table of the page's content when something renders it, and a lookup table of the code's
 * when nothing does.
 */
const renderedNames = (ts: typeof TypeScript, files: readonly SpaceSourceFile[]): Set<string> => {
  const names = new Set<string>();
  const aliases = new Map<string, string>();
  for (const source of files) {
    eachNode(ts, source.sourceFile, node => {
      if (
        ts.isCallExpression(node) &&
        ts.isPropertyAccessExpression(node.expression) &&
        RENDERING.has(node.expression.name.text)
      ) {
        const name = lastName(ts, node.expression.expression);
        if (name !== undefined) {
          names.add(name);
        }
      } else if (ts.isPropertyAssignment(node) && propertyName(ts, node.name) === 'items') {
        const name = lastName(ts, node.initializer);
        if (name !== undefined) {
          names.add(name);
        }
      } else if (ts.isImportSpecifier(node) && node.propertyName && ts.isIdentifier(node.propertyName)) {
        aliases.set(node.name.text, node.propertyName.text);
      }
    });
  }

  for (const [alias, original] of aliases) {
    if (names.has(alias)) {
      names.add(original);
    }
  }

  return names;
};

/** Whether the list is rendered: mapped where it is written, given as a list's `items`, or named by what is. */
const isRendered = (ts: typeof TypeScript, node: TypeScript.ArrayLiteralExpression, rendered: Set<string>): boolean => {
  const outer = outerOf(ts, node);
  const parent = outer.parent;
  if (ts.isPropertyAccessExpression(parent) && RENDERING.has(parent.name.text)) {
    return true;
  }

  if (ts.isPropertyAssignment(parent)) {
    const name = propertyName(ts, parent.name);

    return name === 'items' || (name !== undefined && rendered.has(name));
  }

  return ts.isVariableDeclaration(parent) && ts.isIdentifier(parent.name) && rendered.has(parent.name.text);
};

export const inlineRecords: Rule = ({ ts, files, dataDir }) => {
  const rendered = renderedNames(ts, files);

  return files.flatMap(source => {
    const found: LintFinding[] = [];
    const reported: TypeScript.Node[] = [];
    const within = (node: TypeScript.Node): boolean =>
      reported.some(outer => node.pos >= outer.pos && node.end <= outer.end);
    eachNode(ts, source.sourceFile, node => {
      if (!ts.isArrayLiteralExpression(node) || node.elements.length < MIN_RECORDS || within(node)) {
        return;
      }

      const records = node.elements.filter(element => isRecordLiteral(ts, element));
      if (records.length !== node.elements.length || !isTable(ts, records) || !isRendered(ts, node, rendered)) {
        return;
      }

      if (enclosingNames(ts, node).some(name => CONFIGURATION.has(name))) {
        return;
      }

      reported.push(node);
      found.push(inlineFinding(ts, source, node, records.length, dataDir));
    });

    return found;
  });
};

const inlineFinding = (
  ts: typeof TypeScript,
  source: SpaceSourceFile,
  node: TypeScript.ArrayLiteralExpression,
  count: number,
  dataDir: string
): LintFinding => {
  const place = placeOf(source, node);
  const file = `${dataDir}/${dataName(ts, node)}.json`;
  const reader =
    dataDir === 'src/data'
      ? `an \`apiContainer\` (\`runtime: 'server'\`, \`query: '/data/${dataName(ts, node)}.json'\`)`
      : `an \`apiContainer\` (\`query: '/data/${dataName(ts, node)}.json'\`)`;

  return finding(
    'inline-records',
    `${String(count)} records written inline (lines ${String(place.line)}–${String(endLineOf(source, node))}): move them to ${file} and read them with ${reader} into one \`list\` whose row is written once — the rows are then the space's data, changed without touching a page.`,
    place
  );
};
