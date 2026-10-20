import { isRecord } from '@plitzi/sdk-shared/helpers';

import type { LintContext } from './context';
import type { Element } from '@plitzi/sdk-shared';

/** A value at a dotted path of a record, as the list reads its `itemKey`. */
const fieldOf = (item: unknown, path: string): unknown =>
  path.split('.').reduce<unknown>((value, key) => (isRecord(value) ? value[key] : undefined), item);

/**
 * A list's `itemKey` that does not name each of its fixed items once. The list falls back to the items' `id`, then to
 * their position, so the rows do not stay with their items as the author meant. Bound items arrive at run time and
 * are not read here.
 */
export const warnItemKey = (ctx: LintContext, element: Element, where: string): void => {
  const { itemKey, items } = element.attributes;
  if (typeof itemKey !== 'string' || itemKey === '' || !Array.isArray(items) || items.length === 0) {
    return;
  }

  const keys = items.map(item => fieldOf(item, itemKey));
  const missing = keys.filter(key => typeof key !== 'string' && typeof key !== 'number').length;
  const shared = new Set(keys).size !== keys.length;
  if (missing === 0 && !shared) {
    return;
  }

  ctx.warn(
    'list-item-key-missing',
    `${where} names its rows by "${itemKey}", but ${missing > 0 ? `${String(missing)} of its ${String(items.length)} items have no "${itemKey}"` : `two of its items share one "${itemKey}"`}: the rows fall back to the items' \`id\`, then to their position. Give every item its own "${itemKey}", or name a field that has one.`,
    element.id
  );
};

/** An `<li>`: a `listItem`, or a container that says it is one. */
const isListItem = (element: Element): boolean =>
  element.definition.type === 'listItem' ||
  (element.definition.type === 'container' && element.attributes.subType === 'li');

/** A container with no tag of its own named: the row `list-row-not-li` makes an `<li>` without asking. */
export const isPlainContainer = (element: Element): boolean =>
  element.definition.type === 'container' &&
  (element.attributes.subType === undefined || element.attributes.subType === 'div');

/**
 * The rows of a list with `items`: it is a `<ul>` (an `<ol>` with `subType: 'ol'`) and renders each row straight into
 * it, so a row that is not an `<li>` is a box inside a list — read by a screen reader as no item at all. A plain
 * container becomes one with nothing else to decide; anything else — a link, a button, a component whose root is not an
 * `<li>` — is wrapped, which is the author's to choose, since the wrapper then becomes what the list lays out.
 */
export const warnRowsNotItems = (ctx: LintContext, list: Element): void => {
  const tag = list.attributes.subType === 'ol' ? '<ol>' : '<ul>';
  for (const rowId of list.definition.items ?? []) {
    const row = ctx.element(rowId);
    if (!row || isListItem(row)) {
      continue;
    }

    const component = ctx.instanceOf(row);
    const root = component?.flat[component.rootId];
    if (root && isListItem(root)) {
      continue;
    }

    const how = isPlainContainer(row)
      ? `Write it \`container({ subType: 'li' })\` — its class still lays "${row.id}" out as before.`
      : component
        ? `Make the root of component "${component.id}" an \`<li>\` (\`container({ subType: 'li' })\`), or wrap the instance in one.`
        : `Wrap it in \`container({ subType: 'li', children: [ … ] })\` — the wrapper is then what the list lays out, so move the layout of "${row.id}" onto it.`;
    ctx.warn(
      'list-row-not-li',
      `${ctx.describe(row.id)} is a row of list "${list.id}", which renders as a \`${tag}\`: a row that is not an \`<li>\` is a box inside a list, which a screen reader reads as no item at all. ${how}`,
      row.id
    );
  }
};
