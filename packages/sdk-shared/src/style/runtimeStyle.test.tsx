import { renderToString } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { markStyleCache, RUNTIME_STYLE_ID, styleCacheFromDocument, styleCacheTravelsInDocument } from './runtimeStyle';

/** The runtime stylesheet as the server renders it and the browser parses it — the trip the cache has to survive. */
const throughTheDocument = (css: string): HTMLElement => {
  const root = document.createElement('div');
  root.innerHTML = renderToString(
    <style type="text/css" data-id={RUNTIME_STYLE_ID}>
      {css}
    </style>
  );

  return root;
};

const CACHE = [
  '.hero{font-family:"Geist", sans-serif;background:url("a.png?x=1&y=2")}',
  '.hero > .title::after{content:"\\201C — ✓"}',
  '@media (min-width: 768px){.grid{grid-template-columns:repeat(2,minmax(0,1fr))}}',
  '.a[data-state="on"]:not(.b)~.c+.d{color:light-dark(#000, #fff)}'
].join('\n');

describe('the stylesheet a server-rendered page carries', () => {
  it('reads back from the page exactly as it went in', () => {
    expect(styleCacheTravelsInDocument(CACHE)).toBe(true);

    const root = throughTheDocument(`.plitzi-sdk{--brand:#f00}\n${markStyleCache(CACHE)}.segment{}\n.custom{}`);

    expect(styleCacheFromDocument(root)).toBe(CACHE);
  });

  it('is not read from a page that does not carry it', () => {
    expect(styleCacheFromDocument(throughTheDocument('.plitzi-sdk{}'))).toBeUndefined();
    expect(styleCacheFromDocument(document.createElement('div'))).toBeUndefined();
  });

  it('is sent in the payload whenever the page would not give it back as it is', () => {
    expect(styleCacheTravelsInDocument('.a{color:{{ brand.primary }}}')).toBe(false);
    expect(styleCacheTravelsInDocument('.a{content:"</style>"}')).toBe(false);
    expect(styleCacheTravelsInDocument('.a{}\r\n.b{}')).toBe(false);
    expect(styleCacheTravelsInDocument(`.a{}${String.fromCharCode(0)}`)).toBe(false);
    expect(styleCacheTravelsInDocument('.a{}/*plitzi:style-cache-end*/.b{}')).toBe(false);
    expect(styleCacheTravelsInDocument('')).toBe(false);
  });

  it('would not survive a `<style` inside it — why it is refused', () => {
    const cache = '.a{content:"<style>"}';

    expect(styleCacheFromDocument(throughTheDocument(markStyleCache(cache)))).not.toBe(cache);
  });
});
