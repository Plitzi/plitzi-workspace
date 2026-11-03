import { DEFAULT_IGNORED_QUERY_PARAMS } from './defaults';

import type { SSRPageServerConfig } from '@plitzi/sdk-shared';

/** The parameters this server renders and caches a page without — `cache.ignoredQueryParams`, or the analytics ones. */
export const ignoredQueryParamsOf = (config: Pick<SSRPageServerConfig, 'cache'>): readonly string[] =>
  config.cache?.ignoredQueryParams ?? DEFAULT_IGNORED_QUERY_PARAMS;

const isIgnored = (name: string, ignored: readonly string[]): boolean =>
  ignored.some(pattern => (pattern.endsWith('*') ? name.startsWith(pattern.slice(0, -1)) : name === pattern));

/**
 * The query string as a cache key reads it: without the ignored parameters, and in one order. `?b=2&a=1` and
 * `?a=1&b=2` are the same page, and were two renders. The order of a name given twice is kept — that one a page can
 * tell apart.
 */
export const canonicalSearch = (search: string, ignored: readonly string[]): string => {
  if (search === '' || search === '?') {
    return '';
  }

  const params = [...new URLSearchParams(search.slice(1))].filter(([name]) => !isIgnored(name, ignored));
  if (params.length === 0) {
    return '';
  }

  params.sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));

  return `?${new URLSearchParams(params).toString()}`;
};

/** The query a page is rendered with: what it was asked with, less the ignored parameters. */
export const renderedQuery = (query: Record<string, string>, ignored: readonly string[]): Record<string, string> => {
  const kept = Object.entries(query).filter(([name]) => !isIgnored(name, ignored));

  return kept.length === Object.keys(query).length ? query : Object.fromEntries(kept);
};
