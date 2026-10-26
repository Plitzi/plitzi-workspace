import { getPaths, matchRoutePath } from '@plitzi/sdk-shared/navigation';

import type { Schema } from '@plitzi/sdk-shared';

/**
 * Which page of an authored space answers an address, and for whom — the router's own decision (`getPaths`,
 * `matchRoutePath`), never a reading of the pages' paths beside it: the CLI matched addresses to pages with a copy of
 * the router's rules, and decided by hand which pages a guest alone opens (encore-10's looks read `/sign-in` signed
 * in and pictured Home). What a space is, authoring answers; the tools ask it.
 */

/** What the router does with an address for one visitor: the page it draws, or where it sends them, or neither. */
export interface PageAtAddress {
  /** The page drawn — the space's not-found page too, when nothing else answers. */
  pageId?: string;
  action: 'normal' | 'notFound' | 'redirect' | 'accessDenied';
  /** Where a visitor this page is not for is sent, as the page says it. */
  redirect?: string;
}

/** The page an address draws for a visitor signed in or not, or where the router sends them instead. */
export const pageAt = (
  schema: Pick<Schema, 'flat' | 'pages' | 'pageFolders'>,
  address: string,
  { signedIn = false }: { signedIn?: boolean } = {}
): PageAtAddress => {
  const pages = Object.fromEntries(
    schema.pages.flatMap(id => (Object.hasOwn(schema.flat, id) ? [[id, schema.flat[id]] as const] : []))
  );
  const pathname = new URL(address, 'http://space.invalid').pathname;
  const { action, pageId } = matchRoutePath(getPaths(pages, schema.pageFolders, signedIn), pathname, signedIn);
  // `authenticated` is the router's word for a page that is drawn to whoever asks: no different from `normal` here.
  const type = action.type === 'authenticated' ? 'normal' : action.type;

  return {
    ...(pageId === undefined ? {} : { pageId }),
    action: type,
    ...(action.type === 'redirect' && action.path !== undefined ? { redirect: action.path } : {})
  };
};

/**
 * Whom an address is for, the router asked as a guest and as a signed-in visitor: `everyone` draws the same page to
 * both, `guests` a page only to a guest (a sign-in), `members` only to a signed-in one, `both-apart` a page each
 * (two pages at one path), `nobody` no page to either.
 */
export type Audience = 'everyone' | 'guests' | 'members' | 'both-apart' | 'nobody';

/** Whom an address is for: the router asked as a guest and as a signed-in visitor (`Audience`). */
export const audienceAt = (schema: Pick<Schema, 'flat' | 'pages' | 'pageFolders'>, address: string): Audience => {
  const drawn = (at: PageAtAddress): string | undefined =>
    at.action === 'normal' || at.action === 'notFound' ? at.pageId : undefined;
  const guest = drawn(pageAt(schema, address, { signedIn: false }));
  const member = drawn(pageAt(schema, address, { signedIn: true }));

  return guest !== undefined && member !== undefined
    ? guest === member
      ? 'everyone'
      : 'both-apart'
    : guest !== undefined
      ? 'guests'
      : member !== undefined
        ? 'members'
        : 'nobody';
};
