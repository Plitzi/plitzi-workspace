import { describe, expect, it } from 'vitest';

import { FILTER_DOCS } from './catalog';
import { filters } from './filters';

describe('the template filters, documented', () => {
  it('documents every filter there is, and none there is not', () => {
    expect(Object.keys(FILTER_DOCS).sort()).toEqual(Object.keys(filters).sort());
  });

  it('reads “now” as the moment the page is rendered', () => {
    const year = String(new Date().getUTCFullYear());

    expect(filters.date('now', ['Y', 'UTC'])).toBe(year);
  });
});
