import Button from '@plitzi/plitzi-ui/Button';
import useStorage from '@plitzi/plitzi-ui/hooks/useStorage';
import Switch from '@plitzi/plitzi-ui/Switch';
import { useCallback, useMemo, useState } from 'react';

import EmptyState from '@pmodules/App/components/EmptyState';
import PanelSearch from '@pmodules/App/components/PanelSearch';

import { CATEGORY_COPY, UNUSED_NOTE } from '../../helpers/copy';
import { isUnused } from '../../helpers/usageIndex';
import UsageRow from '../UsageRow';

import type { UsageCategory, UsageItem } from '../../helpers/usageIndex';
import type { ChangeEvent } from 'react';

/** Rows drawn at first: a space with thousands of classes is searched, not scrolled. */
const PAGE_SIZE = 200;

export type UsageListProps = {
  category: UsageCategory;
  items: UsageItem[];
};

/**
 * What the space declares of one kind, each with where it is used — and, filtered, what nothing uses.
 *
 * The search, the filter and the row open are kept among the builder's preferences: opening a component from here
 * draws every panel again inside it, and the list has to be where it was when that is done.
 */
const UsageList = ({ category, items }: UsageListProps) => {
  const copy = CATEGORY_COPY[category];
  const [query, setQuery] = useStorage<string>(`builder-state.usages.${category}.query`, '');
  const [unusedOnly, setUnusedOnly] = useStorage<boolean>(`builder-state.usages.${category}.unusedOnly`, false);
  const [openKey, setOpenKey] = useStorage<string>(`builder-state.usages.${category}.open`, '');
  const [limit, setLimit] = useState(PAGE_SIZE);
  const hasUnused = useMemo(() => items.some(isUnused), [items]);

  const listed = useMemo(() => {
    const needle = query.trim().toLowerCase();

    return items.filter(
      item =>
        (!unusedOnly || isUnused(item)) &&
        (!needle || item.name.toLowerCase().includes(needle) || item.detail.toLowerCase().includes(needle))
    );
  }, [items, query, unusedOnly]);

  const handleQuery = useCallback(
    (value: string) => {
      setQuery(value);
      setLimit(PAGE_SIZE);
    },
    [setQuery]
  );

  const handleUnusedOnly = useCallback(
    (e: ChangeEvent<HTMLInputElement>) => {
      setUnusedOnly(e.target.checked);
      setLimit(PAGE_SIZE);
    },
    [setUnusedOnly]
  );

  const handleToggle = useCallback((key: string) => setOpenKey(state => (state === key ? '' : key)), [setOpenKey]);

  const handleMore = useCallback(() => setLimit(state => state + PAGE_SIZE), []);

  const hidden = listed.length - limit;

  return (
    <div className="flex min-h-0 w-full grow basis-0 flex-col gap-2 p-2">
      {/* With nothing declared there is nothing to search or filter: the empty state alone says so. */}
      {items.length > 0 && (
        <>
          <PanelSearch placeholder={copy.search} value={query} onChange={handleQuery} />
          <div className="flex items-center justify-between gap-2 px-1">
            <span className="text-xs text-zinc-500 dark:text-zinc-400">
              {listed.length} of {items.length}
            </span>
            <Switch size="xs" label={copy.unusedFilter} checked={unusedOnly} onChange={handleUnusedOnly} />
          </div>
        </>
      )}
      {hasUnused && <p className="px-1 text-xs leading-snug text-zinc-500 dark:text-zinc-400">{UNUSED_NOTE}</p>}
      <div className="flex min-h-0 grow basis-0 flex-col overflow-y-auto">
        {items.length === 0 && <EmptyState size="panel" icon={copy.icon} title={copy.empty} />}
        {items.length > 0 && listed.length === 0 && (
          <EmptyState size="panel" icon="fa-solid fa-magnifying-glass" title="Nothing matches" />
        )}
        {listed.slice(0, limit).map(item => (
          <UsageRow
            key={item.key}
            item={item}
            category={category}
            open={item.key === openKey}
            unusedText={copy.unused}
            onToggle={handleToggle}
          />
        ))}
        {hidden > 0 && (
          <Button className="mt-1 w-full" size="xs" intent="secondary" onClick={handleMore}>
            Show {Math.min(hidden, PAGE_SIZE)} more of {hidden}
          </Button>
        )}
      </div>
    </div>
  );
};

export default UsageList;
