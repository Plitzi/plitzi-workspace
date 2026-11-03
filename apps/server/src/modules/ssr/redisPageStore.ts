import type { CacheFilter, SharedPage, SharedPageStore } from '@plitzi/sdk-shared';

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
   * What the pages may take of the Redis, in bytes: past it, the oldest stored are dropped. Default 64 MB. Bounded here
   * rather than by Redis's own eviction, because the Redis a deployment already runs holds what must never be evicted
   * beside it — job queues, sessions — and a cache with no budget there grows until the server is out of memory.
   */
  maxBytes?: number;
};

/**
 * The pages, kept in Lua so a page and its accounting never come apart:
 * - `page:<key>`, the page, with its TTL;
 * - `space:<spaceId>`, a space's pages — `<environment>\n<host>\n<key>` — which an invalidation reads, and `spaces`;
 * - `order:<spaceId>`, a space's pages by when they were stored; `sizes`, each page's bytes;
 * - `bytes`, what all of them hold, and `held`, what each space holds — who gives way when the budget is spent.
 */
const EVICT = `
local function evict(prefix, entry)
  local space, member = string.match(entry, '^([^\\n]*)\\n(.*)$')
  local key = string.match(member, '\\n[^\\n]*\\n(.*)$')
  redis.call('DEL', prefix .. 'page:' .. key)
  redis.call('SREM', prefix .. 'space:' .. space, member)
  redis.call('ZREM', prefix .. 'order:' .. space, entry)
  local size = tonumber(redis.call('HGET', prefix .. 'sizes', entry) or '0')
  redis.call('HDEL', prefix .. 'sizes', entry)
  if tonumber(redis.call('ZINCRBY', prefix .. 'held', -size, space)) <= 0 then
    redis.call('ZREM', prefix .. 'held', space)
  end
  return redis.call('DECRBY', prefix .. 'bytes', size)
end
`;

/**
 * A page stored; then this space's pages past their TTL; then, while the budget is spent, the oldest page of the space
 * that holds the most. On a server of many spaces one that fills the store — a burst, a crawler walking every query
 * string — takes room the others are not using, and gives it back first; on a server of one it is oldest first.
 * KEYS[1] is the prefix: every key the script touches is built from it, and naming it routes the script to the node of
 * a Redis Cluster that holds them (its hash tag).
 */
const SET = `${EVICT}
local prefix, body, ttl, member, space, now, budget = KEYS[1], ARGV[1], tonumber(ARGV[2]), ARGV[3], ARGV[4], tonumber(ARGV[5]), tonumber(ARGV[6])
local entry = space .. '\\n' .. member
if redis.call('HEXISTS', prefix .. 'sizes', entry) == 1 then
  evict(prefix, entry)
end
local key = string.match(member, '\\n[^\\n]*\\n(.*)$')
local size = string.len(body)
redis.call('SET', prefix .. 'page:' .. key, body, 'PX', ttl)
redis.call('SADD', prefix .. 'space:' .. space, member)
redis.call('SADD', prefix .. 'spaces', space)
redis.call('ZADD', prefix .. 'order:' .. space, now, entry)
redis.call('HSET', prefix .. 'sizes', entry, size)
redis.call('ZINCRBY', prefix .. 'held', size, space)
local total = redis.call('INCRBY', prefix .. 'bytes', size)
while true do
  local oldest = redis.call('ZRANGE', prefix .. 'order:' .. space, 0, 0, 'WITHSCORES')
  if #oldest == 0 or oldest[1] == entry or tonumber(oldest[2]) > now - ttl then break end
  total = evict(prefix, oldest[1])
end
while total > budget do
  local victim
  for _, largest in ipairs(redis.call('ZREVRANGE', prefix .. 'held', 0, 1)) do
    local first = redis.call('ZRANGE', prefix .. 'order:' .. largest, 0, 0)[1]
    if first and first ~= entry then
      victim = first
      break
    end
  end
  if not victim then break end
  total = evict(prefix, victim)
end
return total
`;

// The pages of the spaces named (every indexed one when none is), kept to those of an environment and a host when the
// filter names them. A space whose pages are all gone is dropped from the spaces indexed.
const INVALIDATE = `${EVICT}
local prefix, space, environment, host = KEYS[1], ARGV[1], ARGV[2], ARGV[3]
local spaces
if space ~= '' then spaces = { space } else spaces = redis.call('SMEMBERS', prefix .. 'spaces') end
local count = 0
for _, id in ipairs(spaces) do
  for _, member in ipairs(redis.call('SMEMBERS', prefix .. 'space:' .. id)) do
    local env, at = string.match(member, '^([^\\n]*)\\n([^\\n]*)\\n')
    if (environment == '' or env == environment) and (host == '' or at == host) then
      count = count + redis.call('EXISTS', prefix .. 'page:' .. string.match(member, '\\n[^\\n]*\\n(.*)$'))
      evict(prefix, id .. '\\n' .. member)
    end
  end
  if redis.call('SCARD', prefix .. 'space:' .. id) == 0 then
    redis.call('SREM', prefix .. 'spaces', id)
  end
end
return count
`;

const ENCODINGS: readonly SharedPage['encoding'][] = ['br', 'gzip', 'identity'];

/** `<encoding>:<renderedAt>:` and the body's bytes, as they are: one value, no base64 on a page of a hundred KB. */
const envelope = ({ encoding, body, renderedAt }: SharedPage): Buffer =>
  Buffer.concat([Buffer.from(`${encoding}:${renderedAt}:`, 'utf-8'), body]);

const unwrap = (value: Buffer): SharedPage | undefined => {
  const first = value.indexOf(':');
  const second = first < 0 ? -1 : value.indexOf(':', first + 1);
  if (second < 0) {
    return undefined;
  }

  const encoding = ENCODINGS.find(name => name === value.subarray(0, first).toString('utf-8'));
  const renderedAt = Number(value.subarray(first + 1, second).toString('utf-8'));
  if (!encoding || !Number.isFinite(renderedAt)) {
    return undefined;
  }

  return { encoding, renderedAt, body: value.subarray(second + 1) };
};

/**
 * The pages every replica of a deployment shares, in the Redis it already runs (`cache.store`). Each page is filed
 * under its space, so `server.cache.invalidate({ spaceId })` drops exactly that space's — on every replica at once,
 * since they all read here. A value that is not one this store wrote reads as no page.
 */
export const createRedisPageStore = (
  client: RedisPageStoreClient,
  { prefix = 'plitzi:{pages}:', maxBytes = 64 * 1024 * 1024 }: RedisPageStoreOptions = {}
): SharedPageStore => ({
  get: async key => {
    const value = await client.getBuffer(`${prefix}page:${key}`);

    return value ? unwrap(value) : undefined;
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
      body,
      Math.max(1, Math.round(ttlMs)),
      `${environment}\n${hostname}\n${key}`,
      String(spaceId),
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
