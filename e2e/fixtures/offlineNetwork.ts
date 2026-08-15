import type { Page } from '@playwright/test';

/** Cuts the suite off from the public internet.
 *
 *  The sample space points its logo at `cdn.plitzi.com` and the server template pulls Material Icons from Google
 *  Fonts. Left alone, every run depends on two hosts nobody here controls: the suite goes red when somebody
 *  else's CDN has a bad day, and on a CI runner with no egress it never goes green at all.
 *
 *  What the specs actually assert is that the SDK rendered an image element and that the browser could load what
 *  it pointed at — so the request is answered here, deterministically, instead of travelling. A genuinely broken
 *  `src` still fails: only requests that LEAVE the machine are served, and only with the kind of thing they asked
 *  for. */

const PIXEL = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64'
);

const SVG = '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16"><rect width="16" height="16"/></svg>';

const isLocal = (url: string): boolean => {
  const { hostname } = new URL(url);

  return hostname === '127.0.0.1' || hostname === 'localhost' || hostname.endsWith('.plitzi.local');
};

export const stubExternalRequests = async (page: Page): Promise<void> => {
  await page.route('**/*', async route => {
    const url = route.request().url();

    if (!url.startsWith('http') || isLocal(url)) {
      await route.continue();

      return;
    }

    const type = route.request().resourceType();

    if (type === 'image') {
      const svg = url.endsWith('.svg');

      await route.fulfill({
        status: 200,
        contentType: svg ? 'image/svg+xml' : 'image/png',
        body: svg ? SVG : PIXEL
      });

      return;
    }

    if (type === 'stylesheet' || type === 'font') {
      await route.fulfill({ status: 200, contentType: 'text/css', body: '' });

      return;
    }

    /** Everything else is answered empty rather than aborted. An abort is reported to the page as a failed
     *  resource, which every spec then fails on through the console guard — and a space that legitimately loads
     *  a plugin from a CDN would be unable to pass anywhere. Inert content is the honest stand-in: nothing
     *  breaks, and nothing is silently pretended to have worked. */
    const script = type === 'script';

    await route.fulfill({
      status: 200,
      contentType: script ? 'application/javascript' : 'text/plain',
      body: ''
    });
  });
};
