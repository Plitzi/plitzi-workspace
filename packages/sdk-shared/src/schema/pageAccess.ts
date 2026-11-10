import { accessRefusal } from '../actions/access';

import type { AccessCaller } from '../actions/access';
import type { Element, Schema } from '../types';

/**
 * Who may see a page, as the page declares it: the permissions a visitor must hold, all of them. A page that says none
 * is anybody's — `accessLevel` still decides signed in or out — and one that says some is for a signed-in visitor who
 * holds every one: for a platform space, the account's permissions; for any other, those of the visitor roles the space
 * declares and gives them.
 *
 * It is the server that keeps a page to the people it is for. A page a visitor may not see is answered with its refusal
 * and never its content: the content is taken out of the space the browser is sent (`withholdPages`), because a page
 * merely hidden in the browser was still sent to it.
 */
export type PageAccess = { permissions: string[] };

/**
 * What a page answers whoever it is not for (`unauthorizedBehaviour`): its refusal when it says nothing — 401 or 403
 * and `settings.withheldPage` —, `redirect` to `unauthorizedPageRedirect` (signed out), or `notFound`: as if it did not
 * exist — the space's 404 — and nothing of it is sent, not even its name or its path, because a refusal tells whoever
 * probes a path that something is there (a back-office).
 */
export const NOT_FOUND_WHEN_REFUSED = 'notFound';

/** Whether a page answers as if it did not exist to whoever it is not for. */
export const notFoundWhenRefused = (attributes: Record<string, unknown> | undefined): boolean =>
  attributes?.unauthorizedBehaviour === NOT_FOUND_WHEN_REFUSED;

/** A page's access, when its attributes declare one — at least one permission, each a name — or nothing. */
export const pageAccessOf = (attributes: Record<string, unknown> | undefined): PageAccess | undefined => {
  const access = attributes?.access;
  if (typeof access !== 'object' || access === null || !('permissions' in access)) {
    return undefined;
  }

  const { permissions } = access;
  if (!Array.isArray(permissions)) {
    return undefined;
  }

  const names = permissions.filter(
    (permission): permission is string => typeof permission === 'string' && permission !== ''
  );

  return names.length > 0 ? { permissions: names } : undefined;
};

/** Why this visitor may not see a page that declares `access`, or nothing when they may — or when it declares none. */
export const pageAccessRefusal = (
  access: PageAccess | undefined,
  caller: AccessCaller
): 'unauthenticated' | 'forbidden' | undefined =>
  access ? accessRefusal({ mode: 'role', permissions: access.permissions }, caller) : undefined;

/** The attribute a withheld page carries in the space the browser is sent: why it was withheld. */
export const WITHHELD_ATTRIBUTE = 'withheld';

export type PageWithheld = 'unauthenticated' | 'forbidden';

/** Why a page of the space this browser was sent has no content, or nothing when it has its own. */
export const pageWithheldOf = (attributes: Record<string, unknown> | undefined): PageWithheld | undefined => {
  const withheld = attributes?.[WITHHELD_ATTRIBUTE];

  return withheld === 'unauthenticated' || withheld === 'forbidden' ? withheld : undefined;
};

/**
 * The page a page withheld from its visitor draws instead of the platform's refusal (`settings.withheldPage`): one of
 * the space's pages that declares no `access` — or nothing, and the platform's few words. A schema holding only `flat`
 * (a linter's, a page head's) has none.
 */
export const withheldPageOf = (
  schema: Pick<Schema, 'flat'> & Partial<Pick<Schema, 'pages' | 'settings'>>
): string | undefined => {
  const named = schema.settings?.withheldPage;
  if (named === undefined || !schema.pages?.includes(named)) {
    return undefined;
  }

  const page = schema.flat[named] as Element | undefined;

  return page && !pageAccessOf(page.attributes) ? named : undefined;
};

/** The space as one visitor may be sent it, and the accesses of the protected pages it still holds whole. */
export type WithheldSchema = { schema: Schema; withheld: string[]; kept: PageAccess[] };

/**
 * The space with every page this visitor may not see emptied: its elements gone from `flat`, its `items` empty, and
 * `withheld` on it saying why — so the page still routes, and draws its refusal rather than its content. What the
 * visitor may see is left exactly as it was, and a space with no protected page is answered as it came, untouched.
 *
 * `kept` names the accesses of the protected pages left whole, so whoever caches the result can tell which visitors it
 * may be handed to.
 */
export const withholdPages = (schema: Schema, caller: AccessCaller): WithheldSchema => {
  const refusals = new Map<string, Refusal>();
  const kept: PageAccess[] = [];
  for (const pageId of schema.pages) {
    const attributes = (schema.flat[pageId] as Element | undefined)?.attributes;
    const hides = notFoundWhenRefused(attributes);
    // A page for signed-in visitors is kept from the signed out as one for some permissions is: any session, none of
    // them (D2). Only the ones that answer as if they did not exist were, and a visitor of `/terms` downloaded the
    // console's pages — 300 KB of one of them — that their own visit redirects away from.
    const access =
      pageAccessOf(attributes) ?? (attributes?.accessLevel === 'authenticated' ? { permissions: [] } : undefined);
    if (!access) {
      continue;
    }

    const refusal = pageAccessRefusal(access, caller);
    if (refusal) {
      refusals.set(pageId, hides ? 'hidden' : refusal);
    } else {
      kept.push(access);
    }
  }

  if (refusals.size === 0) {
    return { schema, withheld: [], kept };
  }

  return { schema: emptiedSchema(schema, refusals), withheld: [...refusals.keys()], kept };
};

/** Why a page is not this visitor's: withheld (sent empty, saying why), or hidden (not sent at all). */
type Refusal = PageWithheld | 'hidden';

/**
 * The emptied schemas made from one schema, by which pages were withheld and why. Visitors fall into a few such groups —
 * signed out, signed in without a permission — and making one walks every element: made once per group and handed out
 * again, the same object each time, which is what lets whatever is kept by the object (the document the page is sent)
 * be kept for it. Held as long as the schema is.
 */
const emptied = new WeakMap<Schema, Map<string, Schema>>();

/** Past this many groups for one schema, the oldest is made again when it is next asked for. */
const EMPTIED_PER_SCHEMA = 16;

const emptiedSchema = (schema: Schema, refusals: ReadonlyMap<string, Refusal>): Schema => {
  const signature = [...refusals].map(([pageId, refusal]) => `${pageId}:${refusal}`).join('\n');
  const made = emptied.get(schema) ?? new Map<string, Schema>();
  emptied.set(schema, made);
  const known = made.get(signature);
  if (known) {
    return known;
  }

  const flat: Schema['flat'] = {};
  for (const [id, element] of Object.entries(schema.flat)) {
    const refusal = refusals.get(id);
    // A hidden page is not there at all: its path answers what any path the space does not have answers.
    if (refusal === 'hidden') {
      continue;
    }

    if (refusal) {
      flat[id] = {
        ...element,
        attributes: { ...element.attributes, [WITHHELD_ATTRIBUTE]: refusal },
        definition: { ...element.definition, items: [] }
      };
      continue;
    }

    // An element of a withheld page goes with it: what the page holds is what is not to be sent.
    if (id !== element.definition.rootId && refusals.has(element.definition.rootId)) {
      continue;
    }

    flat[id] = element;
  }

  const hidden = [...refusals].filter(([, refusal]) => refusal === 'hidden').map(([pageId]) => pageId);
  const sent: Schema = {
    ...schema,
    flat,
    ...(hidden.length > 0 ? { pages: schema.pages.filter(pageId => !hidden.includes(pageId)) } : {})
  };
  if (made.size >= EMPTIED_PER_SCHEMA) {
    made.delete(made.keys().next().value ?? '');
  }

  made.set(signature, sent);

  return sent;
};

/** Whether a visitor may be handed a space that holds these protected pages whole: they may see every one of them. */
export const mayReceive = (kept: readonly PageAccess[], caller: AccessCaller): boolean =>
  kept.every(access => pageAccessRefusal(access, caller) === undefined);
