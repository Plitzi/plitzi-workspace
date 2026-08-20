import type { ActionTask } from '../types';

const toNumber = (value: string | number | undefined, fallback: number): number => {
  if (value === undefined || value === '') {
    return fallback;
  }

  const parsed = typeof value === 'number' ? value : Number.parseInt(value, 10);

  return Number.isFinite(parsed) ? parsed : fallback;
};

const get: ActionTask<{ key: string }> = {
  namespace: 'kv',
  action: 'get',
  title: 'Read Value',
  params: { key: { type: 'text', canBind: true, defaultValue: '', label: 'Key' } },
  run: async ({ key }, ctx) => ({ value: (await ctx.kv.get(key)) ?? null })
};

const set: ActionTask<{ key: string; value: string; ttlSeconds: string | number }> = {
  namespace: 'kv',
  action: 'set',
  title: 'Write Value',
  params: {
    key: { type: 'text', canBind: true, defaultValue: '', label: 'Key' },
    value: { type: 'codemirror-text', canBind: true, defaultValue: '', label: 'Value' },
    ttlSeconds: { type: 'text', canBind: true, defaultValue: '', label: 'TTL (seconds)' }
  },
  run: async ({ key, value, ttlSeconds }, ctx) => {
    const ttl = ttlSeconds === '' ? undefined : toNumber(ttlSeconds, 0) || undefined;
    await ctx.kv.set(key, value, ttl);

    return { key, stored: true };
  }
};

/**
 * Adds to a counter and answers the new total.
 *
 * This is the primitive rate limiting and idempotency are built from — "has this webhook already been handled",
 * "how many times has this visitor asked today" — which is why it exists before anything that needs it: those
 * two are the first things a public action wants and neither can be expressed with get/set without a race.
 */
const increment: ActionTask<{ key: string; amount: string | number; ttlSeconds: string | number }> = {
  namespace: 'kv',
  action: 'increment',
  title: 'Increment Counter',
  params: {
    key: { type: 'text', canBind: true, defaultValue: '', label: 'Key' },
    amount: { type: 'text', canBind: true, defaultValue: '1', label: 'Amount' },
    ttlSeconds: { type: 'text', canBind: true, defaultValue: '', label: 'TTL (seconds)' }
  },
  run: async ({ key, amount, ttlSeconds }, ctx) => {
    const ttl = ttlSeconds === '' ? undefined : toNumber(ttlSeconds, 0) || undefined;

    return { value: await ctx.kv.increment(key, toNumber(amount, 1), ttl) };
  }
};

const remove: ActionTask<{ key: string }> = {
  namespace: 'kv',
  action: 'delete',
  title: 'Delete Value',
  params: { key: { type: 'text', canBind: true, defaultValue: '', label: 'Key' } },
  run: async ({ key }, ctx) => {
    await ctx.kv.delete(key);

    return { key, deleted: true };
  }
};

export const kvTasks = [get, set, increment, remove] as ActionTask<Record<string, unknown>>[];
