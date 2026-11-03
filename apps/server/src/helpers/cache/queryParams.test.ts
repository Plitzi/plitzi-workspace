import { describe, expect, it } from 'vitest';

import { DEFAULT_IGNORED_QUERY_PARAMS } from './defaults';
import { canonicalSearch, renderedQuery } from './queryParams';

const ignored = DEFAULT_IGNORED_QUERY_PARAMS;

describe('canonicalSearch', () => {
  it('reads two orders of the same parameters as one page', () => {
    expect(canonicalSearch('?b=2&a=1', ignored)).toBe(canonicalSearch('?a=1&b=2', ignored));
  });

  // Every campaign link was a page of its own, rendered for the one visitor who followed it.
  it('leaves out what a link carries for analytics', () => {
    expect(canonicalSearch('?utm_source=news&utm_medium=mail&fbclid=x&page=2', ignored)).toBe('?page=2');
    expect(canonicalSearch('?gclid=abc', ignored)).toBe('');
  });

  it('keeps the order of a name given twice, which a page can tell apart', () => {
    expect(canonicalSearch('?tag=b&z=1&tag=a', ignored)).toBe('?tag=b&tag=a&z=1');
  });

  it('keys every parameter when told to ignore none', () => {
    expect(canonicalSearch('?utm_source=news', [])).toBe('?utm_source=news');
  });

  it('reads an empty query as none', () => {
    expect(canonicalSearch('', ignored)).toBe('');
    expect(canonicalSearch('?', ignored)).toBe('');
  });
});

describe('renderedQuery', () => {
  it('renders the page without the parameters it is cached without', () => {
    expect(renderedQuery({ utm_campaign: 'fall', q: 'shoes' }, ignored)).toEqual({ q: 'shoes' });
  });

  it('hands back the same query when there is nothing to leave out', () => {
    const query = { q: 'shoes' };

    expect(renderedQuery(query, ignored)).toBe(query);
  });
});
