import { describe, expect, it } from 'vitest';

import { isCurrentPage } from './isCurrentPage';

describe('isCurrentPage', () => {
  const at = 'https://shop.example.com/carta/?ref=nav#postres';

  it('is the page shown, whatever its query, section or trailing slash', () => {
    expect(isCurrentPage('/carta', at)).toBe(true);
    expect(isCurrentPage('/carta#vinos', at)).toBe(true);
    expect(isCurrentPage('/', 'https://shop.example.com/')).toBe(true);
  });

  it('is not another page, a page below it, or a page with no address known', () => {
    expect(isCurrentPage('/vinos', at)).toBe(false);
    expect(isCurrentPage('/', at)).toBe(false);
    expect(isCurrentPage('/carta/postres', at)).toBe(false);
    expect(isCurrentPage('/carta', undefined)).toBe(false);
    expect(isCurrentPage('#top', at)).toBe(false);
  });

  it('is the query it names, among links to one path told apart by it', () => {
    const shown = 'https://quake.example.com/?window=24h&mag=4';

    expect(isCurrentPage('/?window=24h', shown)).toBe(true);
    expect(isCurrentPage('/?window=6h', shown)).toBe(false);
    expect(isCurrentPage('/?window=24h&mag=5', shown)).toBe(false);
    expect(isCurrentPage('/', shown)).toBe(true);
    expect(isCurrentPage('/carta?ref=nav', at)).toBe(true);
  });
});
