import type { Helmet } from 'react-helmet-async';

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
