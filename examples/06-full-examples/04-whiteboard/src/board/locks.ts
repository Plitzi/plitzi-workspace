import { createHmac, randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';

/**
 * A board's password, and what opening it hands out.
 *
 * The password is kept as a salted scrypt hash and never leaves the server. Opening the board answers two things
 * derived from it with a secret this process holds: a KEY, which every change to the board must carry, and a TOPIC,
 * the name its realtime channels go by. Nobody who has not opened the board can subscribe to what it says — there is
 * no name to subscribe to — and changing the password changes both, so whoever had the old one is locked out.
 */

export type BoardLock = { salt: string; hash: string; version: number };

/** Made at boot: the boards are in this process's memory too, so nothing signed with it outlives it. */
const SECRET = randomBytes(32);

const derive = (password: string, salt: string): Buffer => scryptSync(password, salt, 32, { N: 16384, r: 8, p: 1 });

const sign = (value: string): string => createHmac('sha256', SECRET).update(value).digest('base64url');

export const MIN_PASSWORD = 4;

export const MAX_PASSWORD = 128;

export const lockWith = (password: string, previous?: BoardLock): BoardLock => {
  const salt = randomBytes(16).toString('base64url');

  return { salt, hash: derive(password, salt).toString('base64url'), version: (previous?.version ?? 0) + 1 };
};

export const passwordOpens = (lock: BoardLock, password: string): boolean => {
  const expected = Buffer.from(lock.hash, 'base64url');

  return timingSafeEqual(derive(password, lock.salt), expected);
};

/** What changes to a locked board carry: bound to its password's version, so a new password voids it. */
export const keyFor = (board: string, lock: BoardLock): string => sign(`key:${board}:${lock.version}`).slice(0, 32);

export const keyOpens = (board: string, lock: BoardLock, key: unknown): boolean => {
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
export const topicFor = (board: string, lock: BoardLock | undefined): string =>
  lock ? `${board}.${sign(`topic:${board}:${lock.version}`).slice(0, 20)}` : board;
