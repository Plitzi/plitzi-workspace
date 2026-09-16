import { useCallback, useEffect, useMemo, useState } from 'react';

import FreshnessRow from './components/FreshnessRow';
import { toRows } from './helpers';
import useFreshnessRecords from '../../../../../../scope/useFreshnessRecords';

import type { DevStore } from '@plitzi/nexus';

export type FreshnessPanelProps = {
  store: DevStore | undefined;
};

/**
 * The paths of the selected store that were written with a TTL: how old each one is, how long it has left, and a
 * way to expire it — which is how a developer checks that whatever depends on it refreshes. Absent for a store that
 * holds none, so it costs nothing to look at the others.
 */
const FreshnessPanel = ({ store }: FreshnessPanelProps) => {
  const records = useFreshnessRecords(store);
  const count = Object.keys(records).length;
  const [now, setNow] = useState(() => Date.now());

  // The clock the rows are read against moves when a record changes — a row written after the last tick would read
  // as written in the future — and once a second, the finest step a countdown shows.
  useEffect(() => store?.watchFreshness(() => setNow(Date.now())), [store]);

  useEffect(() => {
    if (count === 0) {
      return undefined;
    }

    const timer = setInterval(() => setNow(Date.now()), 1000);

    return () => clearInterval(timer);
  }, [count]);

  const rows = useMemo(() => toRows(records, now), [records, now]);

  const handleExpire = useCallback(
    (path: string) => {
      store?.expire(path);
    },
    [store]
  );
  const handleExpireAll = useCallback(() => {
    store?.expire();
  }, [store]);

  if (count === 0) {
    return null;
  }

  return (
    <div className="shrink-0 border-b border-zinc-200 text-[11px] dark:border-zinc-800">
      <div className="flex items-center gap-2 px-2 py-1">
        <span className="font-medium text-zinc-600 dark:text-zinc-300">TTL</span>
        <span className="text-zinc-400 tabular-nums dark:text-zinc-500">{count}</span>
        <button
          className="ml-auto cursor-pointer rounded px-1.5 text-violet-600 hover:bg-violet-500/15 dark:text-violet-300"
          onClick={handleExpireAll}
          title="Mark every path stale now"
        >
          Expire all
        </button>
      </div>
      <ul className="max-h-40 overflow-auto pb-1">
        {rows.map(row => (
          <FreshnessRow key={row.path} row={row} onExpire={handleExpire} />
        ))}
      </ul>
    </div>
  );
};

export default FreshnessPanel;
