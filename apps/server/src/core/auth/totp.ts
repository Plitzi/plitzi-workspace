import { createHmac, randomBytes, randomInt, timingSafeEqual } from 'node:crypto';

/**
 * Time-based one-time passwords, RFC 6238, on the standard library.
 *
 * Six digits over HMAC-SHA1 in thirty-second steps, because that is what every authenticator app assumes and the
 * point of this is that Google Authenticator, 1Password and Aegis all work without being told anything. The RFC
 * allows SHA-256 and other digit counts; almost nothing in the wild reads them off the enrolment URI.
 */

const DIGITS = 6;
const STEP_SECONDS = 30;

/** RFC 4648 base32, which is the alphabet authenticator apps expect a secret in. No padding: apps dislike it. */
const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

const base32Encode = (bytes: Buffer): string => {
  let bits = 0;
  let value = 0;
  let output = '';

  for (const byte of bytes) {
    value = (value << 8) | byte;
    bits += 8;

    while (bits >= 5) {
      output += ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }

  if (bits > 0) {
    output += ALPHABET[(value << (5 - bits)) & 31];
  }

  return output;
};

const base32Decode = (secret: string): Buffer => {
  const clean = secret.toUpperCase().replace(/[^A-Z2-7]/g, '');
  const bytes: number[] = [];
  let bits = 0;
  let value = 0;

  for (const character of clean) {
    value = (value << 5) | ALPHABET.indexOf(character);
    bits += 5;

    if (bits >= 8) {
      bytes.push((value >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }

  return Buffer.from(bytes);
};

/** A 20-byte secret, which is what RFC 4226 recommends for HMAC-SHA1 and what apps are sized for. */
export const generateTotpSecret = (): string => base32Encode(randomBytes(20));

const codeAt = (secret: string, counter: number): string => {
  const buffer = Buffer.alloc(8);
  buffer.writeUInt32BE(Math.floor(counter / 2 ** 32), 0);
  buffer.writeUInt32BE(counter >>> 0, 4);

  const digest = createHmac('sha1', base32Decode(secret)).update(buffer).digest();
  // Dynamic truncation, RFC 4226 §5.3: the low nibble of the last byte picks where to read four bytes from.
  const offset = digest[digest.length - 1] & 0x0f;
  const binary =
    ((digest[offset] & 0x7f) << 24) |
    ((digest[offset + 1] & 0xff) << 16) |
    ((digest[offset + 2] & 0xff) << 8) |
    (digest[offset + 3] & 0xff);

  return String(binary % 10 ** DIGITS).padStart(DIGITS, '0');
};

/** The code an app would be showing right now. Exported so a test does not have to reimplement the algorithm. */
export const totpCode = (secret: string, at: number = Date.now()): string =>
  codeAt(secret, Math.floor(at / 1000 / STEP_SECONDS));

/**
 * Is this the code?
 *
 * `window` steps either side are accepted, one by default — thirty seconds of tolerance for a clock that drifts
 * and for a person who starts typing at second twenty-nine. Wider is friendlier and weaker; this is the usual
 * trade and the same one Google Authenticator's own guidance makes.
 *
 * Compared in constant time: a comparison that returns on the first differing digit leaks how much of a guess was
 * right, which turns a million-guess space into ten guesses per position.
 */
export const verifyTotp = (secret: string, code: string, options: { window?: number; at?: number } = {}): boolean => {
  const { window = 1, at = Date.now() } = options;
  const candidate = code.trim();

  if (!/^\d{6}$/.test(candidate)) {
    return false;
  }

  const counter = Math.floor(at / 1000 / STEP_SECONDS);
  const supplied = Buffer.from(candidate);

  let matched = false;
  for (let drift = -window; drift <= window; drift++) {
    const expected = Buffer.from(codeAt(secret, counter + drift));
    // Not short-circuited: leaving the loop on the first match would leak which step matched through timing.
    matched = timingSafeEqual(expected, supplied) || matched;
  }

  return matched;
};

/**
 * The URI an authenticator app scans. `issuer` appears twice by convention — in the label and as a parameter —
 * because different apps read different ones, and an entry that says only an email address is unidentifiable in a
 * list of thirty.
 */
export const totpUri = ({ secret, account, issuer }: { secret: string; account: string; issuer: string }): string => {
  const label = encodeURIComponent(`${issuer}:${account}`);
  const params = new URLSearchParams({ secret, issuer, algorithm: 'SHA1', digits: String(DIGITS), period: '30' });

  return `otpauth://totp/${label}?${params.toString()}`;
};

/**
 * An unbiased random string over an alphabet.
 *
 * `randomInt` rejection-samples, which is the whole point: the obvious `byte % alphabet.length` over-represents the
 * first `256 % length` characters, and a token that gates an account has to draw every character with equal
 * probability. Hand-rolling that correctly is a known trap, so it is written once here.
 *
 * Default alphabet is Crockford-ish base32 — no `0`/`O`/`1`/`I`, so a code read aloud or off paper survives.
 */
export const randomCode = (length: number, alphabet: string = ALPHABET): string =>
  Array.from({ length }, () => alphabet[randomInt(alphabet.length)]).join('');

/**
 * Recovery codes, for the phone that went in a river.
 *
 * Ten of them, each 40 bits of entropy in a shape somebody can read off paper. Generated once and shown once: they
 * are stored hashed, so a deployment that loses them cannot print them again, which is the property that makes
 * them worth having.
 */
export const generateRecoveryCodes = (count = 10): string[] =>
  Array.from({ length: count }, () => {
    const digits = randomCode(10);

    return `${digits.slice(0, 5)}-${digits.slice(5)}`;
  });

/** Normalised before hashing so that case and the hyphen a person types or omits do not decide whether it works. */
export const normalizeRecoveryCode = (code: string): string =>
  code
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '');
