import { getPaths, matchRoutePath } from '@plitzi/sdk-shared/navigation';

import type { Element, Schema, SSRUser } from '@plitzi/sdk-shared';

export type RscPageMatch = {
  pageId: string;
  routeParams: Record<string, string | undefined>;
};

/**
 * Which page of the schema a URL addresses, matched with the same matcher the client router uses — so the element
 * set and the route params a read resolves against are the ones the browser will see.
 *
 * Its own function because two callers need the answer: the read itself, and the page render deciding beforehand
 * whether there is anything on this page worth asking an adapter for. `undefined` when the URL matches no page,
 * which is also nothing to resolve.
 */
export const matchRscPage = (schema: Schema, path: string, user: SSRUser | undefined): RscPageMatch | undefined => {
  const pages = schema.pages.reduce<Record<string, Element>>((acum, pageId) => {
    const page = schema.flat[pageId] as Element | undefined;
    if (page) {
      acum[pageId] = page;
    }

    return acum;
  }, {});

  const paths = getPaths(pages, schema.pageFolders, !!user);
  const { pageId, pathMatch } = matchRoutePath(paths, path, !!user);
  if (!pageId) {
    return undefined;
  }

  return { pageId, routeParams: pathMatch?.params ?? {} };
};
