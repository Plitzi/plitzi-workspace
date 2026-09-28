import { randomToken, sameText, toBase64url } from './crypto.ts';

import type { FunctionContext } from '@plitzi/sdk-server/functions';

/**
 * A board's password, and what opening it hands out.
 *
 * The password is kept as a salted PBKDF2 hash and never leaves the server. Opening the board answers a KEY, signed
 * with a secret the deployment holds, which every change to the board must carry — and GRANTS to its channels, which
 * the platform keeps: nobody who has not opened the board can subscribe to what it says, however well they know its
 * name. Changing the password changes the key and the topic, so whoever had the old one is locked out.
 */

/** `iterations` is kept with the hash, so raising {@link PASSWORD_ITERATIONS} leaves the boards locked before it working. */
export type BoardLock = { salt: string; hash: string; iterations: number; version: number };

/** PBKDF2-HMAC-SHA-512 at OWASP's count for it: slow on purpose, and the one derivation Web Crypto has everywhere. */
const PASSWORD_ITERATIONS = 210_000;

const derive = async (password: string, salt: string, iterations: number): Promise<string> => {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', hash: 'SHA-512', salt: new TextEncoder().encode(salt), iterations },
    key,
    256
  );

  return toBase64url(new Uint8Array(bits));
};

export const MIN_PASSWORD = 6;

export const MAX_PASSWORD = 128;

/**
 * What anybody tries first. Not a dictionary: the handful that a list of leaked passwords opens with, and the words
 * this board's own name suggests.
 */
const GUESSED = new Set([
  'password',
  'passw0rd',
  'contraseña',
  'contrasena',
  'qwerty',
  'azerty',
  'abc123',
  'letmein',
  'welcome',
  'iloveyou',
  'admin',
  'secret',
  'changeme',
  'monkey',
  'dragon',
  'sunshine',
  'football',
  'pizarra',
  'whiteboard'
]);

/** Keyboard rows, and the alphabet and the digits: typed along any of them, a password is no secret. */
const RUNS = ['qwertyuiop', 'asdfghjkl', 'zxcvbnm', 'abcdefghijklmnopqrstuvwxyz', '01234567890'];

const alongARun = (text: string): boolean =>
  RUNS.some(run => run.includes(text) || Array.from(run).toReversed().join('').includes(text));

/**
 * Why a password would not keep anybody out — or nothing, for one that would. Length and guessability only, as NIST
 * has it: no rules about digits and capitals, which make passwords harder to remember and no harder to guess.
 */
export const passwordProblem = (text: string): string | undefined => {
  if (text.length < MIN_PASSWORD) {
    return `A password is at least ${MIN_PASSWORD} characters — a few words together are easy to remember`;
  }

  if (text.length > MAX_PASSWORD) {
    return `A password is at most ${MAX_PASSWORD} characters`;
  }

  const lower = text.toLowerCase();
  if (GUESSED.has(lower) || new Set(lower).size === 1 || alongARun(lower)) {
    return 'That password is one anybody would try first — a few words together, like “red kite mondays”, are not';
  }

  return undefined;
};

export const lockWith = async (password: string, previous?: BoardLock): Promise<BoardLock> => {
  const salt = randomToken(16);

  return {
    salt,
    hash: await derive(password, salt, PASSWORD_ITERATIONS),
    iterations: PASSWORD_ITERATIONS,
    version: (previous?.version ?? 0) + 1
  };
};

export const passwordOpens = async (lock: BoardLock, password: string): Promise<boolean> =>
  sameText(await derive(password, lock.salt, lock.iterations), lock.hash);

/**
 * The part of a board's topics after `board:` and `room:`. What keeps a locked board's channels to whoever opened it is
 * the grant opening it answered — the channels are declared `grant: true` — so the name needs no secret; it carries
 * the password's version, so a new password is a new topic, and a grant for the old one opens nothing that is said now.
 */
export const topicFor = (board: string, lock: BoardLock | undefined): string =>
  lock ? `${board}.v${String(lock.version)}` : board;

export type BoardSigner = ReturnType<typeof createSigner>;

/**
 * What a board's keys are: signatures with the space's own key (`ctx.sign`), which the server keeps and every replica
 * shares — a key one of them handed out is checked by whichever the next change reaches, and this code never holds
 * what they are signed with.
 */
export const createSigner = ({ sign, verify }: Pick<FunctionContext, 'sign' | 'verify'>) => {
  /** What changes to a locked board carry: bound to its password's version, so a new password voids it. */
  const keyFor = (board: string, lock: BoardLock): Promise<string> => sign(`key:${board}:${String(lock.version)}`);

  const keyOpens = async (board: string, lock: BoardLock, key: unknown): Promise<boolean> =>
    typeof key === 'string' && key !== '' && (await verify(`key:${board}:${String(lock.version)}`, key));

  /**
   * What whoever made a board holds: the one thing that may make it read-only for everyone else, and still change it
   * while it is. Handed out once — to the page that created or copied the board — and never stored.
   */
  const ownerKeyFor = (board: string): Promise<string> => sign(`owner:${board}`);

  const ownerOpens = async (board: string, key: unknown): Promise<boolean> =>
    typeof key === 'string' && key !== '' && (await verify(`owner:${board}`, key));

  return { keyFor, keyOpens, ownerKeyFor, ownerOpens };
};
