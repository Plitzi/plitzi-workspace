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
 */
export const collectServerElements = (schema: Schema, pageId: string | undefined, ids?: string[]): Element[] => {
  if (pageId === undefined) {
    return [];
  }

  const requested = ids ? new Set(ids) : undefined;
  const collected: Element[] = [];
  const seen = new Set<string>();
  const pending = [pageId];
  while (pending.length > 0) {
    const id = pending.pop();
    if (id === undefined || seen.has(id)) {
      continue;
    }

    seen.add(id);
    const element = schema.flat[id] as Element | undefined;
    if (!element) {
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
export const hasServerElements = (schema: Schema, pageId: string | undefined): boolean =>
  collectServerElements(schema, pageId).length > 0;
