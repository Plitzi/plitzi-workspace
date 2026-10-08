import { resolveLayoutChain } from './layoutChain';
import getSourceName from '../dataSource/helpers/getSourceName';
import { passesFlagGate } from '../flags/resolveFlags';
import { processTwigValue } from '../helpers/twigWrapper';

import type { Element, Schema } from '../types';

/**
 * Which elements of a page want data from the server — the one definition of it, because both sides of RSC have to
 * agree on the answer. The rendering server asks before calling its `getRscData` adapter, and the client asks before
 * spending a request on `/_rsc`: a page whose subtree holds no `runtime: 'server'` element has nobody to give a
 * payload to, so resolving one costs an API call, a connector read or a round trip that nothing will ever read.
 *
 * Page-scoped and not schema-scoped on purpose. A space is normally a mix — one page backed by a CMS, the next one
 * static — and the whole point is that rendering the static one must not pay for the other one's providers.
 *
 * The walk is iterative to stay safe on deeply nested schemas, and follows `definition.items`, so a server element
 * nested under any number of plain containers is still found.
 *
 * **It starts from the page AND every shell around it.** A layout is rendered with the page — its sidebar, its header
 * — so a server element that lives in one is on this page as far as the visitor can tell. Walked from the page alone,
 * a provider in the dashboard's sidebar was never resolved: the payload came back empty, the element rendered with
 * nothing, and no layer reported it.
 */
/**
 * Given the flags as they resolved, an element gated off by one is skipped with its whole subtree — it will not be
 * rendered, so nothing in it wants data, and resolving it would put a feature that is off into the payload anyway.
 */
export const collectServerElements = (
  schema: Pick<Schema, 'flat'>,
  pageId: string | undefined,
  ids?: string[],
  flags?: Record<string, boolean>
): Element[] => {
  if (pageId === undefined) {
    return [];
  }

  const requested = ids ? new Set(ids) : undefined;
  const collected: Element[] = [];
  const seen = new Set<string>();
  const page = schema.flat[pageId] as Element | undefined;
  const text = (value: unknown): string => (typeof value === 'string' ? value : '');
  const shells = page
    ? resolveLayoutChain(
        id => schema.flat[id] as Element | undefined,
        text(page.attributes.layout),
        text(page.attributes.layoutContainer)
      ).map(link => link.layout)
    : [];
  const pending = [pageId, ...shells];
  while (pending.length > 0) {
    const id = pending.pop();
    if (id === undefined || seen.has(id)) {
      continue;
    }

    seen.add(id);
    const element = schema.flat[id] as Element | undefined;
    if (!element || (flags && !passesFlagGate(element.definition.flag, flags))) {
      continue;
    }

    if (element.definition.runtime === 'server' && (!requested || requested.has(element.id))) {
      collected.push(element);
    }

    const { items } = element.definition;
    if (items) {
      pending.push(...items);
    }
  }

  return collected;
};

/** Whether anything on this page consumes server data at all — the question both RSC gates actually ask. */
export const hasServerElements = (
  schema: Schema,
  pageId: string | undefined,
  flags?: Record<string, boolean>
): boolean => collectServerElements(schema, pageId, undefined, flags).length > 0;

/** Where the visitor is: what a template on the server reads beside the page's data, as `navigation`. */
export type ServerNavigation = { routeParams: Record<string, unknown>; queryParams: Record<string, unknown> };

/**
 * The server provider of a page whose answer says the address shows nothing — its `notFound`, a template against
 * that answer (`{{ source.found == false }}`) — by id; the page is then sent with status 404, rendered as written.
 *
 * Only `true` counts: a template that does not evaluate comes back as its own text, and a typo must leave the page
 * found rather than turn every visit into a 404.
 */
export const notFoundProvider = (
  elements: Element[],
  serverData: Record<string, unknown>,
  navigation: ServerNavigation
): string | undefined =>
  elements.find(element => {
    const template = element.attributes.notFound;

    return (
      typeof template === 'string' &&
      template !== '' &&
      Object.hasOwn(serverData, element.id) &&
      processTwigValue(template, { source: serverData[element.id], navigation }) === true
    );
  })?.id;

/**
 * What a page's own templates read — its title, its description, its `notFound`: every server provider of the page and
 * of the shells around it, by the name its descendants read it by (`apiContainer_capsule`), with its answer — and
 * `navigation`. The server has both before it writes the head, and the browser has the same answer in `rsc.data`, so
 * the two write one title.
 */
export const pageServerContext = (
  elements: Element[],
  serverData: Record<string, unknown>,
  navigation: ServerNavigation
): Record<string, unknown> => ({
  ...Object.fromEntries(
    elements
      .filter(element => Object.hasOwn(serverData, element.id))
      .map(element => [getSourceName(element.definition.type, element.id), serverData[element.id]])
  ),
  navigation
});

const TEMPLATE = /\{[{%]/;

/**
 * A page's title or description as the head carries it: its words, or its template evaluated against
 * `pageServerContext`. Blank, or a template that did not evaluate — it comes back as its own text — is nothing, and the
 * deployment's own title stays: braces never reach a tab or a link preview.
 */
export const pageSeoText = (value: unknown, context: Record<string, unknown>): string | undefined => {
  if (typeof value !== 'string') {
    return undefined;
  }

  const written = TEMPLATE.test(value) ? processTwigValue(value, context) : value;
  const text = typeof written === 'string' || typeof written === 'number' ? String(written).trim() : '';

  return text === '' || TEMPLATE.test(text) ? undefined : text;
};

/**
 * Whether a page's own `notFound` — a template over `pageServerContext` — says the address shows nothing: a record
 * read by a provider the page shares with others, in its layout, which cannot say it for any one page itself. Only
 * `true` counts, as for a provider's.
 */
export const pageNotFound = (template: unknown, context: Record<string, unknown>): boolean =>
  typeof template === 'string' && template !== '' && processTwigValue(template, context) === true;
