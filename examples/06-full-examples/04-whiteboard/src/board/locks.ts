import { createHmac, randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';

/**
 * A board's password, and what opening it hands out.
 *
 * The password is kept as a salted scrypt hash and never leaves the server. Opening the board answers two things
 * derived from it with a secret the deployment holds: a KEY, which every change to the board must carry, and a TOPIC,
 * the name its realtime channels go by. Nobody who has not opened the board can subscribe to what it says — there is
 * no name to subscribe to — and changing the password changes both, so whoever had the old one is locked out.
 */

export type BoardLock = { salt: string; hash: string; version: number };

const derive = (password: string, salt: string): Buffer => scryptSync(password, salt, 32, { N: 16384, r: 8, p: 1 });

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

export const lockWith = (password: string, previous?: BoardLock): BoardLock => {
  const salt = randomBytes(16).toString('base64url');

  return { salt, hash: derive(password, salt).toString('base64url'), version: (previous?.version ?? 0) + 1 };
};

export const passwordOpens = (lock: BoardLock, password: string): boolean => {
  const expected = Buffer.from(lock.hash, 'base64url');

  return timingSafeEqual(derive(password, lock.salt), expected);
};

export type BoardSigner = ReturnType<typeof createSigner>;

/**
 * What a board's key and topic are signed with. Every replica must hold the SAME secret: a key one of them handed out
 * is checked by whichever one the next change reaches, and a topic is only one channel if everyone derives one name.
 */
export const createSigner = (secret: Buffer) => {
  const sign = (value: string): string => createHmac('sha256', secret).update(value).digest('base64url');

  /** What changes to a locked board carry: bound to its password's version, so a new password voids it. */
  const keyFor = (board: string, lock: BoardLock): string => sign(`key:${board}:${lock.version}`).slice(0, 32);

  const keyOpens = (board: string, lock: BoardLock, key: unknown): boolean => {
    if (typeof key !== 'string') {
      return false;
    }

    const expected = Buffer.from(keyFor(board, lock));
    const given = Buffer.from(key);

    return given.length === expected.length && timingSafeEqual(given, expected);
  };

  /**
   * The part of a board's topics after `board:` and `room:`. An open board's is its id; a locked board's carries a
   * secret beside it — one segment still, as the channel's `{id}` requires.
   */
  const topicFor = (board: string, lock: BoardLock | undefined): string =>
    lock ? `${board}.${sign(`topic:${board}:${lock.version}`).slice(0, 20)}` : board;

  /**
   * What whoever made a board holds: the one thing that may make it read-only for everyone else, and still change it
   * while it is. Handed out once — to the page that created or copied the board — and never stored.
   */
  const ownerKeyFor = (board: string): string => sign(`owner:${board}`).slice(0, 32);

  const ownerOpens = (board: string, key: unknown): boolean => {
    if (typeof key !== 'string' || !key) {
      return false;
    }

    const expected = Buffer.from(ownerKeyFor(board));
    const given = Buffer.from(key);

    return given.length === expected.length && timingSafeEqual(given, expected);
  };

  return { keyFor, keyOpens, topicFor, ownerKeyFor, ownerOpens };
};
