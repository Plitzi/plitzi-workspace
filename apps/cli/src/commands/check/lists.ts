import chalk from 'chalk';

import type { Authored } from './space';
import type { CheckReport, ListRows } from './types';
import type { BrowserPage } from '../../browser';

/**
 * Each list's rows, drawn and in its source — so an empty one is seen, not inferred from a box.
 */

/**
 * How many rows each list draws: the copies of its row — the most of any of its children, one per row whatever a row
 * hides — inside each of the list's nodes: one, or one per row of a list it is inside. A list whose rows are written
 * out (`written`) draws each of its children once: those there are counted. Runs in the page, self-contained.
 */
export const renderedRowsInPage = (
  lists: { id: string; selector: string; row: string[]; written?: boolean }[]
): [string, number[] | null][] =>
  lists.map(({ id, selector, row, written }) => {
    const nodes = Array.from(document.querySelectorAll(selector));

    return [
      id,
      nodes.length === 0
        ? null
        : nodes.map(node =>
            written === true
              ? row.filter(child => node.querySelector(child) !== null).length
              : Math.max(0, ...row.map(child => node.querySelectorAll(child).length))
          )
    ];
  });

export const listRows = async (
  page: BrowserPage,
  authored: Authored,
  sources: Record<string, number | null>
): Promise<Record<string, ListRows>> => {
  const selectorOf = (id: string): string | undefined =>
    Object.hasOwn(authored.handles.elements, id) ? authored.handles.elements[id].selector : undefined;
  // A list given its items, or whose rows are written out as its children (`list({ children: [...] })`, no source),
  // counts too: its source is what it was given, said only when it is on the page. A run read a static list as "1 row,
  // fed by the row it is in": its children were taken for one row.
  const writtenOut = new Set<string>();
  const fixed = Object.fromEntries(
    Object.values(authored.schema.flat).flatMap(element => {
      const items: unknown = element.attributes.items;
      if (element.definition.type !== 'list' || Object.hasOwn(sources, element.id)) {
        return [];
      }

      if (element.attributes.source !== 'controlled') {
        writtenOut.add(element.id);

        return [[element.id, (element.definition.items ?? []).length] as const];
      }

      return Array.isArray(items) ? [[element.id, items.length] as const] : [];
    })
  );
  const all = { ...sources, ...fixed };
  const lists = Object.keys(all).flatMap(id => {
    const selector = selectorOf(id);
    const row = (authored.schema.flat[id].definition.items ?? []).flatMap(child => selectorOf(child) ?? []);

    return selector ? [{ id, selector, row, ...(writtenOut.has(id) ? { written: true } : {}) }] : [];
  });
  const rendered = new Map(lists.length > 0 ? await page.evaluate(renderedRowsInPage, lists) : []);

  return Object.fromEntries(
    Object.entries(all)
      .filter(([id]) => !Object.hasOwn(fixed, id) || (rendered.get(id) ?? null) !== null)
      .map(([id, source]) => {
        const counts = rendered.get(id) ?? null;

        return [
          id,
          {
            rendered: counts === null ? null : counts.reduce((sum, count) => sum + count, 0),
            source,
            ...(counts !== null && counts.length > 1 ? { copies: counts } : {}),
            ...(writtenOut.has(id) ? { written: true } : {})
          }
        ];
      })
  );
};

const rowsText = (count: number): string => `${String(count)} row${count === 1 ? '' : 's'}`;

/** One list's rows in a few words: `plan-list 3 rows`, `feed 4 of 8 rows`, `hits not rendered (16 in its source)`. */
export const listText = (id: string, { rendered, source, copies, written }: ListRows): string => {
  if (written === true && rendered !== null && source !== null) {
    return copies
      ? `${id} ${rowsText(source)} written out, drawn in ${String(copies.length)} copies (${copies.join(', ')})`
      : `${id} ${rendered === source ? rowsText(source) : `${String(rendered)} of ${rowsText(source)}`} written out`;
  }

  // A source the check cannot read — one the page's address names (`navigation.routeParams.slug`) — is no empty
  // list: what the page draws is said ("policy-sections reads nothing" over 13 sections drawn, and the lead
  // sent the task back on it).
  if (source === null && rendered !== null && rendered > 0) {
    return `${id} ${rowsText(rendered)} drawn — its source not read here (one the address names)`;
  }

  if (source === null) {
    return `${id} reads nothing`;
  }

  if (rendered === null) {
    return `${id} not rendered (${String(source)} in its source)`;
  }

  // Drawn once per row of the list it is in: each copy shows its own share, and together what they draw.
  if (copies) {
    // Fed by the row it sits in (`group.item.questions`), its source is no list the page has whole: none to count.
    return source === 0 && rendered > 0
      ? `${id} ${rowsText(rendered)} in ${String(copies.length)} copies (${copies.join(', ')}), each fed by the row it is in`
      : `${id} ${rowsText(rendered)} in ${String(copies.length)} copies (${copies.join(', ')}) of ${String(source)} in its source`;
  }

  // One copy left — the others hidden, a search that kept one group — is still fed by its row: there is no whole to count.
  if (source === 0 && rendered > 0) {
    return `${id} ${rowsText(rendered)}, fed by the row it is in`;
  }

  return `${id} ${rendered === source ? rowsText(source) : `${String(rendered)} of ${rowsText(source)}`}`;
};

/** Each list's rows, drawn and in its source — so an empty one is seen, not inferred from a box. */
export const listsText = (lists: CheckReport['lists']): string[] => {
  const entries = Object.entries(lists);
  if (entries.length === 0) {
    return [];
  }

  return [chalk.dim(`  · lists: ${entries.map(([id, rows]) => listText(id, rows)).join(', ')}`)];
};
