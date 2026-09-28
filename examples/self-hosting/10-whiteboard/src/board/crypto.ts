/**
 * What the boards need of cryptography, from the web's own `crypto` — never `node:crypto` — so the board code runs
 * wherever a space's functions do: in this process, or in the platform's sandbox.
 */

/** Bytes as text for a key or an id: base64url, no padding. */
export const toBase64url = (bytes: Uint8Array): string =>
  btoa(String.fromCharCode(...bytes))
    .replaceAll('+', '-')
    .replaceAll('/', '_')
    .replace(/=+$/u, '');

/** `length` bytes from the CSPRNG, as base64url. */
export const randomToken = (length: number): string => toBase64url(crypto.getRandomValues(new Uint8Array(length)));

/**
 * A whole number in [0, max) from the CSPRNG, with no bias toward the low end: 53 random bits, drawn again when they
 * land in the last, partial run of `max`.
 */
export const randomInt = (max: number): number => {
  if (!Number.isSafeInteger(max) || max < 1) {
    throw new RangeError(`randomInt takes a whole number from 1 to ${String(Number.MAX_SAFE_INTEGER)}`);
  }

  const range = 2 ** 53;
  const limit = range - (range % max);
  for (;;) {
    const [high, low] = crypto.getRandomValues(new Uint32Array(2));
    const value = (high >>> 11) * 2 ** 32 + low;
    if (value < limit) {
      return value % max;
    }
  }
};

/** Equal or not, in the same time whatever the first difference: what comparing a secret someone sent needs. */
export const sameBytes = (given: Uint8Array, expected: Uint8Array): boolean => {
  let difference = given.length ^ expected.length;
  expected.forEach((byte, index) => {
    difference |= byte ^ (given[index] ?? 0);
  });

  return difference === 0;
};

export const sameText = (given: string, expected: string): boolean =>
  sameBytes(new TextEncoder().encode(given), new TextEncoder().encode(expected));
