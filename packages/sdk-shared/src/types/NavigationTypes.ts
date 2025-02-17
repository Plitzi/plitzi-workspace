export type NavigationContextValue = {
  navigate: (url: string, isExternal?: boolean) => void;
  urlSearchParams?: Record<string, string>;
  routeParams: Record<string, string>;
  queryParams: Record<string, string>;
  hostname?: string;
  currentPageId?: string;
};
