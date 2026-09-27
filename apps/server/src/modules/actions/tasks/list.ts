import { MAX_LIST_ENTRIES } from '../runtime/kvList';

import type { ActionTask } from '../types';

const toNumber = (value: string | number | undefined, fallback: number | undefined): number | undefined => {
  if (value === undefined || value === '') {
    return fallback;
  }

  const parsed = typeof value === 'number' ? value : Number(value);

  return Number.isFinite(parsed) ? parsed : fallback;
};

/** What a typed value means: JSON when it reads as JSON, the text itself when it does not. A bound value as it is. */
const valueOf = (value: unknown): unknown => {
  if (typeof value !== 'string') {
    return value ?? null;
  }

  if (value === '') {
    return null;
  }

  try {
    return JSON.parse(value) as unknown;
  } catch {
    return value;
  }
};

const nameParam = { type: 'text', canBind: true, defaultValue: '', label: 'List' } as const;

/**
 * Puts an entry in a list, ordered by score: the latest things (score = when it happened), a leaderboard (score = points),
 * a gallery. An entry with the same id is replaced, so a list never holds one thing twice.
 *
 * A list is read whole, so it is for what a page shows at once — at most {@link MAX_LIST_ENTRIES} entries and 60 KB;
 * `keep` cuts it to the highest scores on every write.
 */
const put: ActionTask<{ list: string; id: string; score: string | number; value: unknown; keep: string | number }> = {
  namespace: 'list',
  action: 'put',
  title: 'Add To List',
  params: {
    list: nameParam,
    id: { type: 'text', canBind: true, defaultValue: '', label: 'Entry id' },
    score: { type: 'text', canBind: true, defaultValue: '0', label: 'Score (highest first)' },
    value: { type: 'codemirror-json', canBind: true, defaultValue: '', label: 'Value' },
    keep: { type: 'text', canBind: true, defaultValue: '', label: `Keep at most (≤ ${MAX_LIST_ENTRIES})` }
  },
  run: async ({ list, id, score, value, keep }, ctx) => {
    const sorted = toNumber(score, undefined);
    if (sorted === undefined) {
      throw new Error(`A score is a number, and "${String(score)}" is not one`);
    }

    await ctx.kv.listPut(list, { id, score: sorted, value: valueOf(value) }, { keep: toNumber(keep, undefined) });

    return { list, id, stored: true };
  }
};

const range: ActionTask<{ list: string; offset: string | number; limit: string | number; order: string }> = {
  namespace: 'list',
  action: 'range',
  title: 'Read List',
  params: {
    list: nameParam,
    offset: { type: 'text', canBind: true, defaultValue: '0', label: 'Skip' },
    limit: { type: 'text', canBind: true, defaultValue: '20', label: 'How many' },
    order: {
      type: 'select',
      canBind: true,
      defaultValue: 'desc',
      label: 'Order',
      options: [
        { label: 'Highest score first', value: 'desc' },
        { label: 'Lowest score first', value: 'asc' }
      ]
    }
  },
  run: async ({ list, offset, limit, order }, ctx) => {
    const entries = await ctx.kv.listRange(list, {
      offset: toNumber(offset, 0),
      limit: toNumber(limit, undefined),
      order: order === 'asc' ? 'asc' : 'desc'
    });

    return { list, entries };
  }
};

const remove: ActionTask<{ list: string; id: string }> = {
  namespace: 'list',
  action: 'remove',
  title: 'Remove From List',
  params: { list: nameParam, id: { type: 'text', canBind: true, defaultValue: '', label: 'Entry id' } },
  run: async ({ list, id }, ctx) => ({ list, id, removed: await ctx.kv.listRemove(list, id) })
};

export const listTasks = [put, range, remove] as ActionTask<Record<string, unknown>>[];
