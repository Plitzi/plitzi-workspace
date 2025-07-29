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

export type Server = {
  // Dashboard
  apiServer: string;
  ssrServer: string;
  // SDK
  basePath: string;
  host: string;
  nodeServer: string;
  graphqlServer: string;
  websocketServer: string;
  subscriptionServer: string;
  // Others
  location?: Location;
} & Record<string, string>;
