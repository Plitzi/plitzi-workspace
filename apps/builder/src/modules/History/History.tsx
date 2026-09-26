import Button from '@plitzi/plitzi-ui/Button';
import Checkbox from '@plitzi/plitzi-ui/Checkbox';
import Select from '@plitzi/plitzi-ui/Select';
import clsx from 'clsx';
import { Fragment, useCallback, useMemo, useState } from 'react';

import { useBuilderStore } from '@plitzi/sdk-shared/store';

import ChangeGroup from './components/ChangeGroup';
import SnapshotMarker from './components/SnapshotMarker';
import { groupChanges, MUTED, ORIGIN_FILTERS, originFilterLabel, placeSnapshots, rowKey } from './helpers';
import useSpaceChanges from './hooks/useSpaceChanges';

import type { ChangeOrigin } from '@plitzi/sdk-shared';
import type { ChangeEvent } from 'react';

/**
 * The space's change history: every save of its schema and style, by whoever made it — a person, an agent, the
 * autofix — newest first, with the published revisions marked where they fall. Read-only: it answers "what changed,
 * who did it and what exactly", and never writes anything back.
 */
const History = () => {
  const [elementSelected] = useBuilderStore('elementSelected');
  const [origin, setOrigin] = useState<'' | ChangeOrigin>('');
  const [onlySelected, setOnlySelected] = useState(false);
  // The date is kept when the box is ticked: the markers come with the data, which is refetched when a filter moves.
  const [since, setSince] = useState<number | undefined>();

  const filters = useMemo(
    () => ({
      ...(origin ? { origin } : {}),
      ...(onlySelected && elementSelected ? { entityId: elementSelected } : {}),
      ...(since !== undefined ? { since } : {})
    }),
    [elementSelected, onlySelected, origin, since]
  );
  const { changes, snapshots, complete, loading, error, loadMore, refresh } = useSpaceChanges(filters);
  const rows = useMemo(
    () => placeSnapshots(groupChanges(changes), snapshots, complete),
    [changes, complete, snapshots]
  );
  const latestSnapshot = snapshots.at(0);

  const handleOrigin = useCallback(
    (value: string) => setOrigin(ORIGIN_FILTERS.find(candidate => candidate === value) ?? ''),
    []
  );
  const handleOnlySelected = useCallback((e: ChangeEvent<HTMLInputElement>) => setOnlySelected(e.target.checked), []);
  const handleSince = useCallback(
    (e: ChangeEvent<HTMLInputElement>) => setSince(e.target.checked ? latestSnapshot?.publishedAt : undefined),
    [latestSnapshot]
  );

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex flex-col gap-2 border-b border-zinc-200 p-2 dark:border-zinc-700">
        <div className="flex items-end gap-2">
          <Select value={origin} label="Made by" onChange={handleOrigin} size="xs" className="grow">
            {ORIGIN_FILTERS.map(candidate => (
              <option key={candidate || 'anyone'} value={candidate}>
                {originFilterLabel(candidate)}
              </option>
            ))}
          </Select>
          <Button size="xs" title="Read the history again" onClick={refresh}>
            <i className="fa-solid fa-rotate" />
          </Button>
        </div>
        <Checkbox
          size="xs"
          label="Only the selected element"
          checked={onlySelected}
          disabled={!elementSelected}
          onChange={handleOnlySelected}
        />
        <Checkbox
          size="xs"
          label="Since the last snapshot"
          checked={since !== undefined}
          disabled={!latestSnapshot && since === undefined}
          onChange={handleSince}
        />
      </div>
      <ul className="flex min-h-0 grow flex-col overflow-y-auto">
        {rows.map(row => (
          <Fragment key={rowKey(row)}>
            {row.type === 'group' && <ChangeGroup group={row.group} />}
            {row.type === 'snapshot' && <SnapshotMarker snapshot={row.snapshot} />}
          </Fragment>
        ))}
      </ul>
      {error && <p className="p-3 text-xs text-red-600 dark:text-red-400">The history could not be read.</p>}
      {!error && loading && <p className={clsx('p-3 text-xs', MUTED)}>Loading…</p>}
      {!error && !loading && rows.length === 0 && (
        <p className={clsx('p-3 text-xs', MUTED)}>Nothing recorded yet. Every change saved from now on appears here.</p>
      )}
      {!error && !loading && !complete && (
        <div className="border-t border-zinc-200 p-2 dark:border-zinc-700">
          <Button size="xs" className="w-full" onClick={loadMore}>
            Older changes
          </Button>
        </div>
      )}
    </div>
  );
};

export default History;
