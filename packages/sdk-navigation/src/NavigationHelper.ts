// The routing core lives in sdk-shared so the client router and the server (SSR/RSC route resolution) share one
// implementation instead of drifting apart. This module stays as the package's public surface.
export {
  getPageFullPath,
  getPaths,
  getRouteParams,
  isPageAuthored,
  matchPath,
  matchRoutePath
} from '@plitzi/sdk-shared/navigation';

export type {
  NavigationAccessLevel,
  NavigationAction,
  Path,
  PathMatch,
  PathPattern
} from '@plitzi/sdk-shared/navigation';
