/**
 * Deterministic hex digest, in plain TypeScript.
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
 * Mongo-shaped, so an authored document is indistinguishable from an exported one — but derived from the path that
 * produced it, so authoring the same space twice writes byte-identical documents and a seed can re-run without
 * churning what it wrote last time.
 */
export const authoringId = (path: string): string => digest(`plitzi:authoring:${path}`, 24);
