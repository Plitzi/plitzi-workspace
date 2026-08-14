import { randomBytes, randomUUID, scrypt as scryptCallback, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';

const scrypt = promisify(scryptCallback) as (password: string, salt: string, keylen: number) => Promise<Buffer>;

const KEY_LENGTH = 64;

/**
 * Password hashing that a deployment does not have to choose.
 *
 * `scrypt` from the standard library, so this costs no dependency and nothing has to be compiled. It is a memory-hard
 * KDF and an entirely respectable answer; argon2 or bcrypt are better ones, and a deployment that wants either passes
 * its own `verifyPassword`/`hashPassword` to `createAuth` — nothing here assumes an algorithm.
 *
 * The format is `scrypt$<salt>$<hash>`, tagged so a later change of algorithm can recognise what it is looking at
 * instead of guessing from the shape.
 */
export const hashPassword = async (plain: string): Promise<string> => {
  const salt = randomBytes(16).toString('hex');
  const derived = await scrypt(plain, salt, KEY_LENGTH);

  return `scrypt$${salt}$${derived.toString('hex')}`;
};

export const verifyPassword = async (plain: string, stored: string): Promise<boolean> => {
  const [algorithm, salt, digest] = stored.split('$');
  if (algorithm !== 'scrypt' || !salt || !digest) {
    return false;
  }

  const expected = Buffer.from(digest, 'hex');
  if (expected.length !== KEY_LENGTH) {
    return false;
  }

  const actual = await scrypt(plain, salt, KEY_LENGTH);

  // Constant-time: a comparison that returns early on the first differing byte tells an attacker how much of a
  // guess was right, which turns a search of the whole space into a search of one byte at a time.
  return timingSafeEqual(expected, actual);
};

/** Opaque single-use strings, for validation and password-reset links. */
export const generateToken = (): string => randomUUID().replace(/-/g, '');
