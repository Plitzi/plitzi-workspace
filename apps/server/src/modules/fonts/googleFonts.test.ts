import { beforeEach, describe, expect, it, vi } from 'vitest';

import { createGoogleFontsMirror, GOOGLE_FONTS_PATH } from './googleFonts';

const CSS = `@font-face {
  font-family: 'Geist';
  font-style: normal;
  font-weight: 400;
  src: url(https://fonts.gstatic.com/s/geist/v1/gyByhwUxId8gMEwcGFU.woff2) format('woff2');
  unicode-range: U+0000-00FF;
}`;

const FILE = Buffer.from('wOF2-not-really');

/** Google, as far as the mirror sees it: what it was asked, with which browser, and what it answered. */
const google = () => {
  const asked: { url: string; userAgent: string | null }[] = [];
  let down = false;
  const fetch = vi.fn((input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const url = input instanceof Request ? input.url : input.toString();
    asked.push({ url, userAgent: new Headers(init?.headers).get('user-agent') });
    if (down) {
      return Promise.reject(new Error('ENOTFOUND fonts.googleapis.com'));
    }

    return Promise.resolve(
      url.startsWith('https://fonts.googleapis.com/') ? new Response(CSS) : new Response(new Uint8Array(FILE))
    );
  });

  return {
    asked,
    fetch,
    goDown: () => {
      down = true;
    }
  };
};

const css2 = (search: string) => ({ path: `${GOOGLE_FONTS_PATH}/css2`, query: {}, search });
const file = (path: string) => ({ path: `${GOOGLE_FONTS_PATH}${path}`, query: {}, search: '' });

describe('the Google Fonts mirror', () => {
  beforeEach(() => {
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
  });

  it('serves Google’s stylesheet with its files addressed here, asked as a current browser', async () => {
    const { asked, fetch } = google();
    const mirror = createGoogleFontsMirror({ fetch });

    const answer = await mirror(css2('?family=Geist:wght@400;700&display=swap'));

    expect(answer.status).toBe(200);
    expect(answer.headers['Content-Type']).toBe('text/css; charset=utf-8');
    expect(answer.body).toContain(`url(${GOOGLE_FONTS_PATH}/s/geist/v1/gyByhwUxId8gMEwcGFU.woff2)`);
    expect(answer.body).not.toContain('fonts.gstatic.com');
    expect(asked[0]?.url).toBe('https://fonts.googleapis.com/css2?family=Geist:wght@400;700&display=swap');
    // Without a browser's name, Google answers .ttf files, every script whole.
    expect(asked[0]?.userAgent).toContain('Chrome/');
  });

  it('asks Google once for a stylesheet and a file, however many pages ask at once and after', async () => {
    const { fetch } = google();
    const mirror = createGoogleFontsMirror({ fetch });

    await Promise.all([mirror(css2('?family=Geist&display=swap')), mirror(css2('?family=Geist&display=swap'))]);
    await mirror(css2('?family=Geist&display=swap'));
    const files = await Promise.all([
      mirror(file('/s/geist/v1/gyByhwUxId8gMEwcGFU.woff2')),
      mirror(file('/s/geist/v1/gyByhwUxId8gMEwcGFU.woff2'))
    ]);

    expect(fetch).toHaveBeenCalledTimes(2);
    expect(files[1].body).toEqual(FILE);
    expect(files[1].headers).toMatchObject({
      'Content-Type': 'font/woff2',
      'Cache-Control': 'public, max-age=31536000, immutable',
      'Access-Control-Allow-Origin': '*'
    });
  });

  // An open proxy to Google would be a way to fetch anything of it through this server: only what a page asks for.
  it('refuses what no page asks for: a text subset, another parameter, a file that is not one of Google’s', async () => {
    const { fetch } = google();
    const mirror = createGoogleFontsMirror({ fetch });

    expect((await mirror(css2('?family=Geist&text=Hello'))).status).toBe(400);
    expect((await mirror(css2('?display=swap'))).status).toBe(400);
    expect((await mirror(css2('?family=Geist&display=sideways'))).status).toBe(400);
    expect((await mirror(file('/s/geist/../../etc/passwd'))).status).toBe(404);
    expect((await mirror(file('/l/font?kit=abc'))).status).toBe(404);
    expect(fetch).not.toHaveBeenCalled();
  });

  it('sends the browser to Google itself when Google cannot be reached from here, and says so', async () => {
    const { fetch, goDown } = google();
    goDown();
    const mirror = createGoogleFontsMirror({ fetch });

    const sheet = await mirror(css2('?family=Geist&display=swap'));
    const face = await mirror(file('/s/geist/v1/gyByhwUxId8gMEwcGFU.woff2'));

    expect(sheet).toMatchObject({
      status: 307,
      headers: { Location: 'https://fonts.googleapis.com/css2?family=Geist&display=swap' }
    });
    expect(face.headers.Location).toBe('https://fonts.gstatic.com/s/geist/v1/gyByhwUxId8gMEwcGFU.woff2');
    expect(console.warn).toHaveBeenCalled();
  });
});
