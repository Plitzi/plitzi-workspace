import { serverLog } from '@plitzi/sdk-kernel/log';

import { bytesFromEnvironment, CACHE_ENV, DEFAULT_CACHE_BYTES } from '../../helpers/cache';

import type { CacheFilter } from '../../types';
import type { SharedPage, SharedPageStore } from '../../types';

/**
 * What the store needs of a Redis client — ioredis's own methods by these names: the deployment hands in the client it
 * already runs, and this package depends on no Redis library.
 */
export type RedisPageStoreClient = {
  getBuffer: (key: string) => Promise<Buffer | null>;
  eval: (script: string, numKeys: number, ...args: (string | number | Buffer)[]) => Promise<unknown>;
};

export type RedisPageStoreOptions = {
  /**
   * Put in front of every key. The default's `{pages}` is a hash tag: on a Redis Cluster every key of the store lands
   * on one node, which is what lets an invalidation drop a space's pages in one script.
   */
  prefix?: string;
  /**
   * What the pages may take of the Redis, in bytes. Default `SDK_SERVER_CACHE_STORE_MAX_BYTES` (`512MB`, `2GB`), else
   * 128 MB. Bounded here rather than by Redis's own eviction, because the Redis a deployment already runs holds what
   * must never be evicted beside it — job queues, sessions — and a cache with no budget there grows until the server is
   * out of memory.
   */
  maxBytes?: number;
};

/**
 * The pages, kept in Lua so a page and its accounting never come apart — a segmented LRU, as each process's own
 * (`TtlCache`): a page starts on probation and is protected once it is used again (read by a replica, or stored again by
 * one); probation gives way first, and protected pages past 80% of the budget go back to it.
 * - `page:<key>`, the page, with its TTL; `where`, each page's `<spaceId>\n<environment>\n<host>`; `sizes`, its bytes;
 * - `space:<spaceId>`, a space's pages, which an invalidation reads, and `spaces`, the spaces that have any;
 * - `probation` and `protected`, the pages by when they were last used, and `bytes:<lane>`, what each holds.
 * KEYS[1] is the prefix: every key a script touches is built from it, and naming it routes the script to the node of a
 * Redis Cluster that holds them (its hash tag).
 */
const LANES = `
local LANES = { 'probation', 'protected' }

local function evict(prefix, key)
  local where = redis.call('HGET', prefix .. 'where', key)
  if where then
    local space = string.match(where, '^([^\\n]*)\\n')
    redis.call('SREM', prefix .. 'space:' .. space, key)
    if redis.call('SCARD', prefix .. 'space:' .. space) == 0 then
      redis.call('SREM', prefix .. 'spaces', space)
    end
  end
  local size = tonumber(redis.call('HGET', prefix .. 'sizes', key) or '0')
  for _, lane in ipairs(LANES) do
    if redis.call('ZREM', prefix .. lane, key) == 1 then
      redis.call('DECRBY', prefix .. 'bytes:' .. lane, size)
    end
  end
  redis.call('HDEL', prefix .. 'where', key)
  redis.call('HDEL', prefix .. 'sizes', key)
  return redis.call('DEL', prefix .. 'page:' .. key)
end

local function place(prefix, key, lane, now)
  local size = tonumber(redis.call('HGET', prefix .. 'sizes', key) or '0')
  for _, other in ipairs(LANES) do
    if other ~= lane and redis.call('ZREM', prefix .. other, key) == 1 then
      redis.call('DECRBY', prefix .. 'bytes:' .. other, size)
    end
  end
  if redis.call('ZADD', prefix .. lane, now, key) == 1 then
    redis.call('INCRBY', prefix .. 'bytes:' .. lane, size)
  end
end

local function held(prefix, lane)
  return tonumber(redis.call('GET', prefix .. 'bytes:' .. lane) or '0')
end

local function balance(prefix, kept, now, budget)
  while held(prefix, 'protected') > budget * 0.8 do
    local oldest = redis.call('ZRANGE', prefix .. 'protected', 0, 0)[1]
    if not oldest or oldest == kept then break end
    place(prefix, oldest, 'probation', now)
  end
  while held(prefix, 'probation') + held(prefix, 'protected') > budget do
    local victim
    for _, lane in ipairs(LANES) do
      for _, key in ipairs(redis.call('ZRANGE', prefix .. lane, 0, 1)) do
        if key ~= kept then
          victim = key
          break
        end
      end
      if victim then break end
    end
    if not victim then break end
    evict(prefix, victim)
  end
end
`;

// A page stored — protected when it was there already, the sign it is wanted — then the pages nobody used for a TTL
// (theirs has run out), and then as many more as the budget needs.
const SET = `${LANES}
local prefix, key, body, ttl, where, now, budget = KEYS[1], ARGV[1], ARGV[2], tonumber(ARGV[3]), ARGV[4], tonumber(ARGV[5]), tonumber(ARGV[6])
local lane = 'probation'
if redis.call('HEXISTS', prefix .. 'sizes', key) == 1 then
  lane = 'protected'
  evict(prefix, key)
end
local space = string.match(where, '^([^\\n]*)\\n')
redis.call('SET', prefix .. 'page:' .. key, body, 'PX', ttl)
redis.call('HSET', prefix .. 'where', key, where)
redis.call('HSET', prefix .. 'sizes', key, string.len(body))
redis.call('SADD', prefix .. 'space:' .. space, key)
redis.call('SADD', prefix .. 'spaces', space)
place(prefix, key, lane, now)
for _, other in ipairs(LANES) do
  for _, gone in ipairs(redis.call('ZRANGEBYSCORE', prefix .. other, '-inf', now - ttl, 'LIMIT', 0, 32)) do
    evict(prefix, gone)
  end
end
balance(prefix, key, now, budget)
return 1
`;

// A page a replica read: used again, so protected.
const TOUCH = `${LANES}
local prefix, key, now, budget = KEYS[1], ARGV[1], tonumber(ARGV[2]), tonumber(ARGV[3])
if redis.call('HEXISTS', prefix .. 'sizes', key) == 1 then
  place(prefix, key, 'protected', now)
  balance(prefix, key, now, budget)
end
return 1
`;

// The pages of the spaces named (every one with pages when none is), kept to those of an environment and a host when the
// filter names them.
const INVALIDATE = `${LANES}
local prefix, space, environment, host = KEYS[1], ARGV[1], ARGV[2], ARGV[3]
local spaces
if space ~= '' then spaces = { space } else spaces = redis.call('SMEMBERS', prefix .. 'spaces') end
local count = 0
for _, id in ipairs(spaces) do
  for _, key in ipairs(redis.call('SMEMBERS', prefix .. 'space:' .. id)) do
    local env, at = string.match(redis.call('HGET', prefix .. 'where', key) or '', '^[^\\n]*\\n([^\\n]*)\\n(.*)$')
    if (environment == '' or env == environment) and (host == '' or at == host) then
      count = count + evict(prefix, key)
    end
  end
end
return count
`;

const ENCODINGS: readonly SharedPage['encoding'][] = ['br', 'gzip', 'identity'];

/**
 * `<encoding>:<renderedAt>:<script nonce>:` and the body's bytes, as they are: one value, no base64 on a page of a
 * hundred KB. The nonce is base64, which has no `:` in it.
 */
const envelope = ({ encoding, body, renderedAt, nonce }: SharedPage): Buffer =>
  Buffer.concat([Buffer.from(`${encoding}:${renderedAt}:${nonce}:`, 'utf-8'), body]);

const unwrap = (value: Buffer): SharedPage | undefined => {
  const first = value.indexOf(':');
  const second = first < 0 ? -1 : value.indexOf(':', first + 1);
  const third = second < 0 ? -1 : value.indexOf(':', second + 1);
  if (third < 0) {
    return undefined;
  }

  const encoding = ENCODINGS.find(name => name === value.subarray(0, first).toString('utf-8'));
  const renderedAt = Number(value.subarray(first + 1, second).toString('utf-8'));
  if (!encoding || !Number.isFinite(renderedAt)) {
    return undefined;
  }

  const nonce = value.subarray(second + 1, third).toString('utf-8');

  return { encoding, renderedAt, nonce, body: value.subarray(third + 1) };
};

/**
 * The pages every replica of a deployment shares, in the Redis it already runs (`cache.store`). Each page is filed
 * under its space, so `server.cache.invalidate({ spaceId })` drops exactly that space's — on every replica at once,
 * since they all read here. A value that is not one this store wrote reads as no page.
 */
export const createRedisPageStore = (
  client: RedisPageStoreClient,
  {
    prefix = 'plitzi:{pages}:',
    maxBytes = bytesFromEnvironment(CACHE_ENV.storeMaxBytes) ?? DEFAULT_CACHE_BYTES.store
  }: RedisPageStoreOptions = {}
): SharedPageStore => ({
  get: async key => {
    const value = await client.getBuffer(`${prefix}page:${key}`);
    const page = value ? unwrap(value) : undefined;
    if (page) {
      // Not waited for: the page is served whether or not its standing was written down.
      client.eval(TOUCH, 1, prefix, key, Date.now(), maxBytes).catch((error: unknown) => {
        serverLog.debug('SSR cache', 'A shared page was read but not marked as used', error);
      });
    }

    return page;
  },
  set: async (key, page, { spaceId, environment, hostname }, ttlMs) => {
    const body = envelope(page);
    // A page larger than all the store may hold would push every other page out and still not fit.
    if (body.length > maxBytes) {
      return;
    }

    await client.eval(
      SET,
      1,
      prefix,
      key,
      body,
      Math.max(1, Math.round(ttlMs)),
      `${String(spaceId)}\n${environment}\n${hostname}`,
      Date.now(),
      maxBytes
    );
  },
  invalidate: async (filter: CacheFilter = {}) => {
    const count = await client.eval(
      INVALIDATE,
      1,
      prefix,
      filter.spaceId === undefined ? '' : String(filter.spaceId),
      filter.environment ?? '',
      filter.hostname ?? ''
    );

    return typeof count === 'number' ? count : 0;
  }
});
