export type QueryParams = Record<string, string>;
export type RouteParams = Record<string, string>;

export type NavigationContextValue = {
  navigate: (url: string, isExternal?: boolean) => void;
  urlSearchParams?: Record<string, string>;
  routeParams: RouteParams;
  queryParams: QueryParams;
  hostname?: string;
  currentPageId?: string;
};
