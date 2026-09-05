/**
 * Deterministic hex digest, in plain TypeScript. What names a style selector — never an element, a page or a step:
 * those answer to names a person reads.
 *
 * FNV-1a over the string, re-run with a different offset basis per 8-hex block. Not `node:crypto`: this module is
 * exported from the package root, and the builder bundles that root for the browser — one `node:` import here is a
 * broken bundle there. Nothing security-bearing depends on it either; it exists so the same declaration yields the
 * same ids twice, and 96 bits of it is far past collision for the few hundred paths a space contains.
 */
export const digest = (value: string, length: number): string => {
  let out = '';

  for (let block = 0; out.length < length; block += 1) {
    let acc = 0x811c9dc5 ^ (block * 0x01000193);

    for (let index = 0; index < value.length; index += 1) {
      acc ^= value.charCodeAt(index);
      acc = Math.imul(acc, 0x01000193);
    }

    out += (acc >>> 0).toString(16).padStart(8, '0');
  }

  return out.slice(0, length);
};

/**
 * A string as a slug: lowercase, `[a-z0-9-]`, no leading or trailing dash.
 *
 * Two different things need it and they must agree. A space's `permanentUrl` is a DNS label at the platform — a
 * subdomain is built out of it — and it is also what element ids and style selectors are derived from, so a name
 * that arrived from a folder ("My Site", "my_site") has to become one of these before it is written into a spec
 * rather than after, when the documents already carry it.
 */
export const slugify = (value: string, fallback: string): string =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || fallback;
