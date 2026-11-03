import { TtlCache } from '../../helpers/cache/TtlCache';
import { serverLog } from '../../helpers/serverLog';

/** Where a page's Google families are served from, on the page server's own origin. */
export const GOOGLE_FONTS_PATH = '/_plitzi/fonts/google';

const GOOGLE_CSS_ORIGIN = 'https://fonts.googleapis.com';
const GOOGLE_FILE_ORIGIN = 'https://fonts.gstatic.com';

/**
 * Google answers each browser the formats it reads, by its `User-Agent`: one that names no modern browser is answered
 * `.ttf` files without `unicode-range`, every face of every script whole. A current one gets the WOFF2 subsets.
 */
const MODERN_BROWSER =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36';

/** A file of Google's, as its stylesheet names it: `/s/<family>/v<n>/<name>.woff2`, versioned and so never changing. */
const FILE_PATH = /^\/s\/[a-z0-9]+\/v\d+\/[A-Za-z0-9_-]+\.(woff2|woff|ttf)$/;

const FILE_TYPES: Record<string, string> = { woff2: 'font/woff2', woff: 'font/woff', ttf: 'font/ttf' };

/** What one request may name: the page's families (a manifest has a handful), and the one `display` css2 takes. */
const MAX_FAMILIES = 24;
const MAX_FAMILY_LENGTH = 200;
const DISPLAYS = new Set(['auto', 'block', 'swap', 'fallback', 'optional']);

/** Google's own: a stylesheet for a day, which is as long as it keeps one; a file, for good. */
const CSS_TTL_MS = 24 * 60 * 60 * 1000;
const FILE_TTL_MS = 30 * 24 * 60 * 60 * 1000;
const CSS_CACHE_CONTROL = 'public, max-age=86400, stale-while-revalidate=604800';
const FILE_CACHE_CONTROL = 'public, max-age=31536000, immutable';

const SWEEP_MS = 60 * 60 * 1000;

const MAX_CSS_BYTES = 256 * 1024;
const MAX_FILE_BYTES = 2 * 1024 * 1024;
/** The faces every space of this server uses, kept in this process — a dozen families' subsets fit many times over. */
export const DEFAULT_GOOGLE_FONTS_MAX_BYTES = 32 * 1024 * 1024;

export type GoogleFontsAnswer = { status: number; headers: Record<string, string>; body: Buffer | string };

export type GoogleFontsRequest = { path: string; query: Record<string, string>; search: string };

/**
 * The query a stylesheet is asked with, said one way: its families, in the order they came, and its `display` — or
 * nothing, for a request that is not one a page writes (a `text` subset, a family past the bound).
 */
const css2Query = (search: string): string | undefined => {
  const params = new URLSearchParams(search);
  const families = params.getAll('family');
  if (
    families.length === 0 ||
    families.length > MAX_FAMILIES ||
    families.some(family => family.length === 0 || family.length > MAX_FAMILY_LENGTH)
  ) {
    return undefined;
  }

  const display = params.get('display');
  if (display !== null && !DISPLAYS.has(display)) {
    return undefined;
  }

  if ([...params.keys()].some(key => key !== 'family' && key !== 'display')) {
    return undefined;
  }

  const canonical = new URLSearchParams();
  families.forEach(family => {
    canonical.append('family', family);
  });
  if (display !== null) {
    canonical.set('display', display);
  }

  // css2 reads the separators of a family spec literally: `:`, `@`, `;` and `,` stay as a page writes them.
  return canonical.toString().replace(/%3A/g, ':').replace(/%40/g, '@').replace(/%3B/g, ';').replace(/%2C/g, ',');
};

/** One request upstream per key at a time: the pages that ask while it is in flight wait on the same answer. */
const singleFlight = <T>() => {
  const asking = new Map<string, Promise<T>>();

  return (key: string, ask: () => Promise<T>): Promise<T> => {
    const known = asking.get(key);
    if (known) {
      return known;
    }

    const asked = ask().finally(() => asking.delete(key));
    asking.set(key, asked);

    return asked;
  };
};

/** Google's stylesheet, its files addressed where this server serves them. */
const rewritten = (css: string): string => css.replaceAll(`${GOOGLE_FILE_ORIGIN}/`, `${GOOGLE_FONTS_PATH}/`);

/**
 * A page's Google families, served from the page server's own origin rather than Google's.
 *
 * A stylesheet in the head is render-blocking, and Google's are on two origins of their own — the CSS and the files it
 * names — each a DNS lookup, a TLS handshake and a connection the visitor opens before the text is drawn in its face.
 * Served here, they ride the connection the page came on. And the visitor's address is not handed to a third party for
 * a typeface, which in the EU is a question of its own.
 *
 * Asked of Google once per stylesheet and file, kept in this process within `maxBytes`, joined while in flight. Google
 * unreachable is not the page's problem: the browser is sent to Google itself (a redirect), and the server says why.
 */
export const createGoogleFontsMirror = ({
  fetch: base = globalThis.fetch,
  maxBytes = DEFAULT_GOOGLE_FONTS_MAX_BYTES
}: { fetch?: typeof fetch; maxBytes?: number } = {}) => {
  // A stylesheet is a few kilobytes; what fills the budget is the files. Swept hourly: a timer as long as a file's TTL
  // is past what `setInterval` holds, and would fire at once, forever.
  const stylesheets = new TtlCache<string>(CSS_TTL_MS, 500, {
    maxBytes: Math.max(MAX_CSS_BYTES, Math.floor(maxBytes / 16)),
    sizeOf: css => Buffer.byteLength(css),
    sweepIntervalMs: SWEEP_MS
  });
  const files = new TtlCache<Buffer>(FILE_TTL_MS, 5000, {
    maxBytes,
    sizeOf: file => file.byteLength,
    sweepIntervalMs: SWEEP_MS
  });
  const askingCss = singleFlight<string>();
  const askingFile = singleFlight<Buffer>();

  const fetched = async (url: string, maxSize: number): Promise<Response> => {
    const response = await base(url, { headers: { 'User-Agent': MODERN_BROWSER }, redirect: 'error' });
    if (!response.ok) {
      throw new Error(`${url} answered ${String(response.status)}`);
    }

    const declared = Number(response.headers.get('content-length') ?? '');
    if (Number.isFinite(declared) && declared > maxSize) {
      throw new Error(`${url} is larger than ${String(maxSize)} bytes`);
    }

    return response;
  };

  const sentToGoogle = (url: string, error: unknown): GoogleFontsAnswer => {
    serverLog.warn('FONTS', `Google Fonts could not be reached; the browser is sent to ${url}`, error);

    return { status: 307, headers: { Location: url, 'Cache-Control': 'no-store' }, body: '' };
  };

  return async ({ path, search }: GoogleFontsRequest): Promise<GoogleFontsAnswer> => {
    const rest = path.slice(GOOGLE_FONTS_PATH.length);
    if (rest === '/css2') {
      const query = css2Query(search);
      if (query === undefined) {
        return { status: 400, headers: {}, body: 'Not a stylesheet of Google Fonts a page asks for' };
      }

      const upstream = `${GOOGLE_CSS_ORIGIN}/css2?${query}`;
      try {
        const css =
          stylesheets.get(query) ??
          (await askingCss(query, async () => {
            const text = await (await fetched(upstream, MAX_CSS_BYTES)).text();
            if (Buffer.byteLength(text) > MAX_CSS_BYTES) {
              throw new Error(`${upstream} is larger than ${String(MAX_CSS_BYTES)} bytes`);
            }

            const served = rewritten(text);
            stylesheets.set(query, served);

            return served;
          }));

        return {
          status: 200,
          headers: { 'Content-Type': 'text/css; charset=utf-8', 'Cache-Control': CSS_CACHE_CONTROL },
          body: css
        };
      } catch (error) {
        return sentToGoogle(upstream, error);
      }
    }

    const format = FILE_PATH.exec(rest)?.[1];
    if (format === undefined) {
      return { status: 404, headers: {}, body: 'Not found' };
    }

    const upstream = `${GOOGLE_FILE_ORIGIN}${rest}`;
    try {
      const file =
        files.get(rest) ??
        (await askingFile(rest, async () => {
          const bytes = Buffer.from(await (await fetched(upstream, MAX_FILE_BYTES)).arrayBuffer());
          if (bytes.byteLength > MAX_FILE_BYTES) {
            throw new Error(`${upstream} is larger than ${String(MAX_FILE_BYTES)} bytes`);
          }

          files.set(rest, bytes);

          return bytes;
        }));

      return {
        status: 200,
        headers: {
          'Content-Type': FILE_TYPES[format] ?? 'application/octet-stream',
          'Cache-Control': FILE_CACHE_CONTROL,
          // A font is fetched in CORS mode whatever its origin: a space enclosed in another site's page uses it too.
          'Access-Control-Allow-Origin': '*',
          'Cross-Origin-Resource-Policy': 'cross-origin'
        },
        body: file
      };
    } catch (error) {
      return sentToGoogle(upstream, error);
    }
  };
};
