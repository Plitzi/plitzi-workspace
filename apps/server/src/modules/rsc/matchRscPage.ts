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
type RoutePaths = ReturnType<typeof getPaths>;

/**
 * The schema's routes, for a visitor signed out and one signed in — made once per schema object, which the adapters
 * hand every render until the space changes (and a visitor's withheld copy is one per group): every page's route was
 * worked out again on every render to match one address against them.
 */
const routes = new WeakMap<Schema, { signedOut?: RoutePaths; signedIn?: RoutePaths }>();

const routesOf = (schema: Schema, signedIn: boolean): RoutePaths => {
  const known = routes.get(schema) ?? {};
  routes.set(schema, known);
  const kept = signedIn ? known.signedIn : known.signedOut;
  if (kept) {
    return kept;
  }

  const pages = schema.pages.reduce<Record<string, Element>>((acum, pageId) => {
    const page = schema.flat[pageId] as Element | undefined;
    if (page) {
      acum[pageId] = page;
    }

    return acum;
  }, {});
  const made = getPaths(pages, schema.pageFolders, signedIn);
  if (signedIn) {
    known.signedIn = made;
  } else {
    known.signedOut = made;
  }

  return made;
};

export const matchRscPage = (schema: Schema, path: string, user: SSRUser | undefined): RscPageMatch | undefined => {
  const { pageId, pathMatch } = matchRoutePath(routesOf(schema, !!user), path, !!user);
  if (!pageId) {
    return undefined;
  }

  return { pageId, routeParams: pathMatch?.params ?? {} };
};
