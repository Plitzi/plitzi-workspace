import clsx from 'clsx';
import { useCallback, useMemo, useState } from 'react';

import CacheRow from './components/CacheRow';
import {
  describeQueryPath,
  forgetQueryPath,
  toRows,
  useFreshnessByStore,
  useSecondsClock
} from '../../../../freshness';
import { rootKeysOf, storeLabel } from '../../../../scope/helpers';
import { useInstanceStores } from '../../../../scope/useScope';

import type { FreshnessGroup } from '../../../../freshness';

/**
 * Everything this page is keeping, and for how much longer.
 *
 * Its own tab rather than a strip above the state tree, because the two answer different questions. The tree is the
 * shape of one store; this is "what is cached right now" across every store of the instance — and the store holding a
 * TTL is rarely the one being looked at, since a provider's answers live in the query cache and not in its own scope.
 *
 * Everything a row says is on screen: no tooltips, a bar for what is left of the life it was given, and the value it
 * holds one click away, so checking a cache never means going somewhere else to look at it.
 */
const CacheViewer = () => {
  const entries = useInstanceStores();
  const groups = useFreshnessByStore(entries);
  const count = useMemo(() => groups.reduce((sum, group) => sum + Object.keys(group.records).length, 0), [groups]);
  const now = useSecondsClock(count > 0);

  const rootKeys = useMemo(() => rootKeysOf(entries), [entries]);
  const labelOf = useCallback((group: FreshnessGroup) => storeLabel(group.entry, rootKeys), [rootKeys]);
  const rows = useMemo(() => toRows(groups, labelOf, now, describeQueryPath), [groups, labelOf, now]);

  const [filter, setFilter] = useState('');
  const [staleOnly, setStaleOnly] = useState(false);
  const [openKey, setOpenKey] = useState<string | undefined>(undefined);

  const visible = useMemo(() => {
    const needle = filter.trim().toLowerCase();

    return rows.filter(row => {
      if (staleOnly && !row.isStale) {
        return false;
      }

      return (
        !needle ||
        row.label.toLowerCase().includes(needle) ||
        row.storeLabel.toLowerCase().includes(needle) ||
        row.tags.some(tag => tag.toLowerCase().includes(needle))
      );
    });
  }, [rows, filter, staleOnly]);

  const openValue = useMemo(() => {
    const row = visible.find(candidate => candidate.key === openKey);
    if (!row) {
      return undefined;
    }

    return groups.find(group => group.entry.uid === row.uid)?.entry.store.getPath(row.path);
  }, [visible, openKey, groups]);

  const handleToggle = useCallback((key: string) => setOpenKey(current => (current === key ? undefined : key)), []);
  const handleStaleOnly = useCallback(() => setStaleOnly(current => !current), []);

  const handleExpire = useCallback(
    (uid: string, path: string) => {
      groups.find(group => group.entry.uid === uid)?.entry.store.expire(path);
    },
    [groups]
  );

  /**
   * Lets go of what a path holds now, instead of at the end of its grace period.
   *
   * The query cache is told rather than written over: it keeps the request out for that key and the bookkeeping that
   * decides who asks next, and a store write would leave both behind. Anything else is an ordinary unmount write,
   * which drops the value and its record together.
   */
  const handleForget = useCallback(
    (uid: string, path: string) => {
      const entry = groups.find(group => group.entry.uid === uid)?.entry;
      if (!entry || forgetQueryPath(entry.store, path)) {
        return;
      }

      entry.store.setState(path, undefined, { unmount: true });
    },
    [groups]
  );

  const handleExpireAll = useCallback(() => groups.forEach(group => group.entry.store.expire()), [groups]);

  return (
    <div className="flex h-full w-full flex-col text-[11px]">
      <div className="flex shrink-0 items-center gap-2 border-b border-zinc-200 px-2 py-1 dark:border-zinc-800">
        <span className="font-medium text-zinc-600 dark:text-zinc-300">Cached</span>
        <span className="text-zinc-500 tabular-nums dark:text-zinc-400">{count}</span>
        <input
          className="min-w-0 grow rounded border border-zinc-200 bg-white px-1.5 py-0.5 text-zinc-700 outline-none placeholder:text-zinc-400 focus:border-violet-400 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100 dark:placeholder:text-zinc-500"
          value={filter}
          placeholder="Filter by URL, store or tag"
          onChange={event => setFilter(event.target.value)}
        />
        <button
          className={clsx(
            'shrink-0 cursor-pointer rounded px-1.5 py-0.5 font-medium transition-colors',
            staleOnly
              ? 'bg-amber-500/15 text-amber-600 dark:text-amber-400'
              : 'text-zinc-500 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800'
          )}
          onClick={handleStaleOnly}
        >
          Stale only
        </button>
        <button
          className="shrink-0 cursor-pointer rounded px-1.5 py-0.5 text-violet-600 hover:bg-violet-500/15 dark:text-violet-400"
          onClick={handleExpireAll}
        >
          Expire all
        </button>
      </div>
      {visible.length === 0 ? (
        <div className="flex grow flex-col items-center justify-center gap-2 px-6 text-center text-zinc-500 dark:text-zinc-400">
          <i className="fa-solid fa-database text-3xl opacity-20" />
          <span>{count === 0 ? 'Nothing on this page is cached' : 'Nothing matches the filter'}</span>
          {count === 0 && (
            <span className="max-w-80 text-[10px]">
              A path appears here once something writes it with a time to live — a provider does that when its author
              turns its cache on.
            </span>
          )}
        </div>
      ) : (
        <ul className="grow overflow-auto">
          {visible.map(row => (
            <CacheRow
              key={row.key}
              row={row}
              isOpen={row.key === openKey}
              value={row.key === openKey ? openValue : undefined}
              onToggle={handleToggle}
              onExpire={handleExpire}
              onForget={handleForget}
            />
          ))}
        </ul>
      )}
    </div>
  );
};

export default CacheViewer;
