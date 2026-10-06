import { SPACE_DIR } from '../../scaffold/paths';
import { eachNode, endLineOf, isLiteralValue, isPlainString, placeOf, propertyName, propertyValue } from '../ast';
import { finding } from '../catalog';

import type { Rule, SpaceSourceFile } from '../types';
import type TypeScript from 'typescript';

/**
 * A page family — a list and its detail page, a privacy and a terms page — may share a file. Past this many pages, and
 * this many lines of them, it is a site's pages a reader scrolls through to find one.
 */
export const MAX_PAGES = 2;
export const MAX_PAGES_LINES = 150;

/** In the entry, which only assembles the space, two pages of more than a few lines are already its pages. */
const MAX_ENTRY_PAGES_LINES = 40;

interface WrittenPage {
  node: TypeScript.ObjectLiteralExpression;
  name: string;
  lines: number;
}

/**
 * The pages a file writes out: object literals with a `name`, a `slug` and a `body` of elements, as a `PageSpec` is —
 * not a record of data that happens to have a slug and a body of paragraphs (an article), nor a factory's page, whose
 * name is a parameter: a factory is how a family of pages is written once.
 */
const pagesIn = (ts: typeof TypeScript, source: SpaceSourceFile): WrittenPage[] => {
  const pages: WrittenPage[] = [];
  eachNode(ts, source.sourceFile, node => {
    if (!ts.isObjectLiteralExpression(node)) {
      return;
    }

    const name = propertyValue(ts, node, 'name');
    const body = propertyValue(ts, node, 'body');
    const hasSlug = node.properties.some(property => propertyName(ts, property.name) === 'slug');
    if (!name || !isPlainString(ts, name) || !hasSlug || !body || isLiteralValue(ts, body)) {
      return;
    }

    pages.push({ node, name: name.text, lines: endLineOf(source, node) - placeOf(source, node).line + 1 });
  });

  return pages;
};

export const pagesInOneFile: Rule = ({ ts, files, entry }) =>
  files.flatMap(source => {
    const pages = pagesIn(ts, source);
    const lines = pages.reduce((sum, page) => sum + page.lines, 0);
    const tooMany =
      source.file === entry
        ? pages.length >= 2 && lines > MAX_ENTRY_PAGES_LINES
        : pages.length > MAX_PAGES && lines > MAX_PAGES_LINES;
    if (!tooMany) {
      return [];
    }

    const names = pages.map(page => `“${page.name}”`).join(', ');
    const where = source.file === entry ? `${entry} — which only assembles the space —` : 'this file';

    return [
      finding(
        'pages-in-one-file',
        `${String(pages.length)} pages (${names}) are written in ${where}, ${String(lines)} lines of them: give each page its own file under ${SPACE_DIR}/pages/ — a page family that shares a shape, one factory function and its data — and import them into ${entry}.`,
        placeOf(source, pages[0].node)
      )
    ];
  });
