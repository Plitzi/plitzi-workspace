import type { ActionKvAdapter } from '../types';

/**
 * The commands this adapter sends, typed by shape rather than by a client library: ioredis answers them as they are,
 * and any client that speaks them does. `eval` is for what Redis has no single command for: `swap`, and an increment
 * that gives the counter its lifetime in the same step.
 */
export type RedisKvClient = {
  get: (key: string) => Promise<string | null>;
  set: {
    (key: string, value: string): Promise<unknown>;
    (key: string, value: string, mode: 'EX', seconds: number): Promise<unknown>;
  };
  del: (key: string) => Promise<number>;
  eval: (script: string, keys: number, ...args: (string | number)[]) => Promise<unknown>;
};

export type RedisKvOptions = {
  /** Put in front of every key, for a Redis that holds other things too. None when absent. */
  prefix?: string;
};

/**
 * Read and write as ONE step: Redis runs a script with nothing else in between, which is what makes it the
 * compare-and-set it has no command for. `ARGV[1]` says whether a value is expected at all — an absent key and one
 * holding the empty string are different things.
 */
const SWAP = `
local current = redis.call('GET', KEYS[1])
if ARGV[1] == 'absent' then
  if current then return 0 end
elseif current ~= ARGV[2] then
  return 0
end
if ARGV[4] == '' then
  redis.call('SET', KEYS[1], ARGV[3])
else
  redis.call('SET', KEYS[1], ARGV[3], 'EX', tonumber(ARGV[4]))
end
return 1
`;

/**
 * An increment and its lifetime as ONE step: `INCRBY`, then — when the counter holds no lifetime, which is what one it
 * just created holds — `EXPIRE`, with nothing in between. Two commands left the key for good when Redis timed out on
 * the second. A live counter keeps the lifetime it has, so a window never stretches on a hit.
 */
const INCREMENT = `
local total = redis.call('INCRBY', KEYS[1], ARGV[1])
if ARGV[2] ~= '' and redis.call('TTL', KEYS[1]) == -1 then
  redis.call('EXPIRE', KEYS[1], tonumber(ARGV[2]))
end
return total
`;

/**
 * An {@link ActionKvAdapter} over Redis: each operation one command, and `swap` and `increment` one script each.
 *
 * `client` may be a function, for a deployment whose connection comes and goes — it is asked on every call, and a
 * client it cannot give is its to refuse (throwing), never this adapter's to read as "no value".
 */
export const createRedisKv = (
  client: RedisKvClient | (() => RedisKvClient),
  { prefix = '' }: RedisKvOptions = {}
): ActionKvAdapter => {
  const redis = typeof client === 'function' ? client : () => client;
  const key = (name: string): string => `${prefix}${name}`;

  return {
    get: async name => (await redis().get(key(name))) ?? undefined,
    set: async (name, value, ttlSeconds) => {
      await (ttlSeconds === undefined
        ? redis().set(key(name), value)
        : redis().set(key(name), value, 'EX', ttlSeconds));
    },
    delete: async name => {
      await redis().del(key(name));
    },
    increment: async (name, amount, ttlSeconds) =>
      Number(await redis().eval(INCREMENT, 1, key(name), amount, ttlSeconds === undefined ? '' : ttlSeconds)),
    swap: async (name, expected, next, ttlSeconds) =>
      (await redis().eval(
        SWAP,
        1,
        key(name),
        expected === undefined ? 'absent' : 'equals',
        expected ?? '',
        next,
        ttlSeconds === undefined ? '' : ttlSeconds
      )) === 1
  };
};
