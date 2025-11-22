import type { Helmet } from '@dr.pogodin/react-helmet';

export type QueryParams = Record<string, string[] | string | undefined>;
export type RouteParams = Record<string, string[] | string | undefined>;

export type NavigationContextValue = {
  Helmet?: typeof Helmet;
  navigate: (url: string, isExternal?: boolean) => void;
  urlSearchParams?: URLSearchParams;
  routeParams: RouteParams;
  queryParams: QueryParams;
  hostname?: string;
  currentPageId: string;
};
