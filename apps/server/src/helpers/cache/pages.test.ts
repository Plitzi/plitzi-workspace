import { describe, expect, it } from 'vitest';

import { fromSharedPage, keepPage, pageHtml, sizeOfPage, toSharedPage } from './pages';
import { DEFAULT_COMPRESSION, resolveCompression } from '../compress';

const large = `<html><body>${'<p>A paragraph the page repeats.</p>'.repeat(2_000)}</body></html>`;

describe('a kept page', () => {
  // A 1 MB page held as a string beside its compressed forms was most of what the cache spent.
  it('is kept compressed alone, and its HTML made from it again', () => {
    const page = keepPage(large, DEFAULT_COMPRESSION);

    expect(page.html).toBeUndefined();
    expect(page.compressed.br).toBeInstanceOf(Buffer);
    expect(sizeOfPage(page)).toBeLessThan(large.length / 10);
    expect(pageHtml(page)).toBe(large);
  });

  it('is kept in the encoding the server prefers first', () => {
    const page = keepPage(large, resolveCompression({ encodings: ['gzip'] }));

    expect(page.compressed.gzip).toBeInstanceOf(Buffer);
    expect(pageHtml(page)).toBe(large);
  });

  it('is kept as it is when there is nothing to compress it to', () => {
    expect(keepPage(large, resolveCompression(false))).toEqual({ html: large, compressed: {} });
    expect(keepPage('<html></html>', DEFAULT_COMPRESSION)).toEqual({ html: '<html></html>', compressed: {} });
  });

  it('travels to a shared store and back as the same page', () => {
    const page = keepPage(large, DEFAULT_COMPRESSION);
    const shared = toSharedPage(page, 1_000);

    expect(shared).toMatchObject({ encoding: 'br', renderedAt: 1_000 });
    expect(pageHtml(fromSharedPage(shared))).toBe(large);
    expect(pageHtml(fromSharedPage(toSharedPage({ html: '<p>x</p>', compressed: {} }, 1)))).toBe('<p>x</p>');
  });
});
