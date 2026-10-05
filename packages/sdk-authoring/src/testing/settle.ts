/** A request, as `openPage` reads it: enough to tell a stream that stays open from a request that ends. */
export interface SettlingRequest {
  url(): string;
  resourceType(): string;
  headers(): Record<string, string>;
}

/** The events `openPage` follows a page's requests by. */
export type SettlingEvent = 'request' | 'requestfinished' | 'requestfailed';

/** What `openPage` needs of a page — a Playwright `Page` is one. */
export interface SettlingPage {
  goto(url: string, options: { waitUntil: 'load' }): Promise<unknown>;
  on(event: SettlingEvent, listener: (request: SettlingRequest) => void): unknown;
  off(event: SettlingEvent, listener: (request: SettlingRequest) => void): unknown;
  waitForTimeout(milliseconds: number): Promise<void>;
}

export interface OpenPageOptions {
  /** How long nothing may be asked for before the page counts as settled. 500 ms, as `networkidle`. */
  quietMs?: number;
  /** The longest it waits for that quiet, after the page loaded — then it goes on anyway. 15 s. */
  timeout?: number;
}

/**
 * A request that is open for as long as the page is: a realtime channel's stream, a socket, a server action answering
 * as it goes. Waiting for it to end is waiting forever.
 */
const staysOpen = (request: SettlingRequest): boolean => {
  // A header the request was sent without is absent, whatever the record's type says.
  const { accept = '' } = request.headers();

  return ['eventsource', 'websocket'].includes(request.resourceType()) || accept.includes('text/event-stream');
};

/**
 * Opens a page and waits until it has settled: loaded, and nothing asked for in `quietMs` — the server data, the
 * images, the plugins it fetches after the HTML.
 *
 * What Playwright's `networkidle` would be if it knew a page with a live channel: `networkidle` counts the channel's
 * stream, which never ends, so on any page with a `channel` it never came — and every check of that page answered
 * that nothing was there. Answers what `goto` did: the response, or `null` when nothing answered.
 */
export const openPage = async (
  page: SettlingPage,
  url: string,
  { quietMs = 500, timeout = 15_000 }: OpenPageOptions = {}
): Promise<unknown> => {
  const open = new Set<SettlingRequest>();
  let lastChange = Date.now();
  const started = (request: SettlingRequest) => {
    if (!staysOpen(request)) {
      open.add(request);
      lastChange = Date.now();
    }
  };
  const ended = (request: SettlingRequest) => {
    if (open.delete(request)) {
      lastChange = Date.now();
    }
  };
  page.on('request', started);
  page.on('requestfinished', ended);
  page.on('requestfailed', ended);

  try {
    const answered = await page.goto(url, { waitUntil: 'load' }).catch(() => null);
    if (!answered) {
      return null;
    }

    const deadline = Date.now() + timeout;
    while (Date.now() < deadline && (open.size > 0 || Date.now() - lastChange < quietMs)) {
      await page.waitForTimeout(50);
    }

    return answered;
  } finally {
    page.off('request', started);
    page.off('requestfinished', ended);
    page.off('requestfailed', ended);
  }
};
