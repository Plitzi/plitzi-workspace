import { useCallback, useEffect, useMemo, useState } from 'react';

import FreshnessRow from './components/FreshnessRow';
import { toRows } from './helpers';
import { rootKeysOf, storeLabel } from '../../../../../../scope/helpers';
import useFreshnessByStore from '../../../../../../scope/useFreshnessByStore';

import type { DescribePath } from './helpers';
import type { FreshnessGroup } from '../../../../../../scope/useFreshnessByStore';
import type { DevStoreEntry } from '@plitzi/nexus';

export type FreshnessPanelProps = {
  /** Every store of the instance the panel is showing — not only the one picked in the header. */
  entries: ReadonlyArray<DevStoreEntry>;
  describe?: DescribePath;
};

/**
 * The paths written with a TTL, in any store of the instance: how old each one is, how long it has left, and a way to
 * expire it — which is how a developer checks that whatever depends on it refreshes. Absent while no store holds one.
 */
const FreshnessPanel = ({ entries, describe }: FreshnessPanelProps) => {
  const groups = useFreshnessByStore(entries);
  const count = useMemo(() => groups.reduce((sum, group) => sum + Object.keys(group.records).length, 0), [groups]);
  const [now, setNow] = useState(() => Date.now());

  // A clock that moves once a second, the finest step a countdown shows; `toRows` never reads it as older than a write.
  useEffect(() => {
    if (count === 0) {
      return undefined;
    }

    const timer = setInterval(() => setNow(Date.now()), 1000);

    return () => clearInterval(timer);
  }, [count]);

  const rootKeys = useMemo(() => rootKeysOf(entries), [entries]);
  const labelOf = useCallback((group: FreshnessGroup) => storeLabel(group.entry, rootKeys), [rootKeys]);
  const rows = useMemo(() => toRows(groups, labelOf, now, describe), [groups, labelOf, now, describe]);

  const handleExpire = useCallback(
    (uid: string, path: string) => {
      groups.find(group => group.entry.uid === uid)?.entry.store.expire(path);
    },
    [groups]
  );

  const handleExpireAll = useCallback(() => {
    groups.forEach(group => group.entry.store.expire());
  }, [groups]);

  if (count === 0) {
    return null;
  }

  return (
    <div className="shrink-0 border-b border-zinc-200 text-[11px] dark:border-zinc-800">
      <div className="flex items-center gap-2 px-2 py-1">
        <span className="font-medium text-zinc-600 dark:text-zinc-300">TTL</span>
        <span className="text-zinc-400 tabular-nums dark:text-zinc-500">{count}</span>
        <span className="text-zinc-400 dark:text-zinc-500">every store of this instance</span>
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
          <FreshnessRow key={row.key} row={row} onExpire={handleExpire} />
        ))}
      </ul>
    </div>
  );
};

export default FreshnessPanel;
