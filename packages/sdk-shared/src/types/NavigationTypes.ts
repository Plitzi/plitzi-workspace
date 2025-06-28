import type { Helmet } from 'react-helmet-async';

export type QueryParams = Record<string, string>;
export type RouteParams = Record<string, string>;

export type NavigationContextValue = {
  Helmet?: typeof Helmet;
  navigate: (url: string, isExternal?: boolean) => void;
  urlSearchParams?: Record<string, string>;
  routeParams: RouteParams;
  queryParams: QueryParams;
  hostname?: string;
  currentPageId?: string;
};
