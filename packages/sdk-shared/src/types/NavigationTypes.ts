export type NavigationStatus = 'authenticated' | 'normal' | 'redirect' | 'notFound' | 'accessDenied';
export type QueryParams = Record<string, string[] | string | undefined>;
export type RouteParams = Record<string, string[] | string | undefined>;
