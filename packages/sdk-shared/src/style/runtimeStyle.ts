/**
 * The space's compiled stylesheet (`style.cache`) on a server-rendered page, which carries it once.
 *
 * The runtime `<style>` the page renders already holds the cache, verbatim, so sending it again in the hydration payload
 * made every page ship its stylesheet twice. Instead the server leaves it out of the payload, and the browser reads it
 * back from that `<style>` before hydrating — the same string, so the client renders the same markup and the store
 * holds the same cache it always did.
 *
 * The cache sits between two comment markers inside the runtime stylesheet: a comment changes nothing about the
 * cascade, and the element and its place in the tree stay exactly what they were.
 */

/** The `data-id` of the stylesheet the SDK renders into the page. */
export const RUNTIME_STYLE_ID = 'plitzi-runtime-style';

const CACHE_START = '/*plitzi:style-cache*/';
const CACHE_END = '/*plitzi:style-cache-end*/';

/** The cache as the runtime stylesheet embeds it, between the markers `styleCacheFromDocument` reads it by. */
export const markStyleCache = (cache: string): string => `${CACHE_START}${cache}${CACHE_END}`;

/**
 * Whether the cache reads back from the document byte for byte, so it can be left out of the payload.
 *
 * - `{{ token }}`: the stylesheet holds the cache with its tokens already replaced, and the browser needs the tokens to
 *   replace them again when a variable changes.
 * - `<`: React escapes a `<style` inside a stylesheet as it renders it, so the text would not come back as it went.
 * - `\r` and `\0`: the HTML parser normalises both.
 * - The end marker: the cache would end early.
 *
 * An empty cache has nothing to save.
 */
export const styleCacheTravelsInDocument = (cache: string): boolean =>
  cache !== '' && !/\{\{|<|\r|\0/.test(cache) && !cache.includes(CACHE_END);

/** The cache the server left in the runtime stylesheet under `root`, or `undefined` when there is none to read. */
export const styleCacheFromDocument = (root: ParentNode): string | undefined => {
  const css = root.querySelector(`style[data-id="${RUNTIME_STYLE_ID}"]`)?.textContent ?? '';
  const start = css.indexOf(CACHE_START);
  const end = css.indexOf(CACHE_END, start);
  if (start < 0 || end < 0) {
    return undefined;
  }

  return css.slice(start + CACHE_START.length, end);
};
