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

  // Built on request by Google, for the families it keeps no static subsets of: kept by the three that name it.
  it('serves a file Google builds on request, as the type it answered, and nothing else under that path', async () => {
    const { asked, fetch } = google();
    const mirror = createGoogleFontsMirror({ fetch });
    const dynamic = {
      path: `${GOOGLE_FONTS_PATH}/l/font`,
      query: {},
      search: '?kit=Yq64-LOTXCb04q32&skey=85bdc4c30fbe73fc&v=v12'
    };

    const answer = await mirror(dynamic);
    await mirror(dynamic);

    expect(answer).toMatchObject({ status: 200, headers: { 'Content-Type': 'font/woff2' }, body: FILE });
    expect(asked.map(({ url }) => url)).toEqual([
      'https://fonts.gstatic.com/l/font?kit=Yq64-LOTXCb04q32&skey=85bdc4c30fbe73fc&v=v12'
    ]);
    expect((await mirror({ ...dynamic, search: `${dynamic.search}&extra=1` })).status).toBe(404);
    expect((await mirror({ ...dynamic, search: '?kit=a&skey=nothex!&v=v1' })).status).toBe(404);
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

  // A Japanese family is a hundred subsets per weight: three weights of it, beside two other families, were 460 KB.
  it('serves the stylesheet of a CJK family whole, and sends to Google only one past what a page could ask for', async () => {
    const face = (index: number) =>
      `@font-face { font-family: 'Zen Kaku Gothic New'; font-weight: 400; src: url(https://fonts.gstatic.com/s/zen/v1/${String(index)}.woff2) format('woff2'); unicode-range: U+${index.toString(16)}00-${index.toString(16)}ff; }\n`;
    // One face repeated past the size: building it face by face took seconds for two megabytes.
    const sheetOf = (bytes: number) => face(0).repeat(Math.ceil(bytes / Buffer.byteLength(face(0))) + 1);
    const answering = (css: string) =>
      vi.fn((): Promise<Response> => Promise.resolve(new Response(css, { headers: { 'content-type': 'text/css' } })));

    const cjk = await createGoogleFontsMirror({ fetch: answering(sheetOf(460 * 1024)) })(
      css2('?family=Zen+Kaku+Gothic+New:wght@400;500;700&display=swap')
    );
    const tooLarge = await createGoogleFontsMirror({ fetch: answering(sheetOf(2 * 1024 * 1024 + 1)) })(
      css2('?family=Zen+Kaku+Gothic+New:wght@400;500;700&display=swap')
    );

    expect(cjk.status).toBe(200);
    expect(String(cjk.body)).toContain(`${GOOGLE_FONTS_PATH}/s/zen/v1/0.woff2`);
    expect(tooLarge.status).toBe(307);

    // And the files it names: a subset is numbered in its name (`….117.woff2`), and is served as any other.
    const { fetch } = google();
    const subset = await createGoogleFontsMirror({ fetch })(file('/s/zenkakugothicnew/v19/gNMVW2drQpDw0Gjz.117.woff2'));
    expect(subset.status).toBe(200);
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
