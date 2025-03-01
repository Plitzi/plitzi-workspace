export type QueryParams = Record<string, string>;
export type RouteParams = Record<string, string>;

export type NavigationContextValue<T = unknown> = {
  Helmet?: T;
  navigate: (url: string, isExternal?: boolean) => void;
  urlSearchParams?: Record<string, string>;
  routeParams: RouteParams;
  queryParams: QueryParams;
  hostname?: string;
  currentPageId?: string;
};
