import { useCallback } from 'react';

import type { Path } from '@plitzi/sdk-store';

export type DemoHistoryEntryProps = {
  index: number;
  path?: Path;
  value?: unknown;
  isActive: boolean;
  isFuture: boolean;
  onSelect: (index: number) => void;
};

const DemoHistoryEntry = ({ index, path, value, isActive, isFuture, onSelect }: DemoHistoryEntryProps) => {
  const handleClick = useCallback(() => onSelect(index), [index, onSelect]);

  const label = path ?? (index === 0 ? 'initial state' : 'replace');

  return (
    <button
      onClick={handleClick}
      className={
        isActive
          ? 'flex w-full items-center gap-2 rounded-md bg-brand-600 px-2.5 py-1.5 text-left font-mono text-xs text-white'
          : `flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-left font-mono text-xs text-zinc-400 transition hover:bg-ink-800 ${isFuture ? 'opacity-50' : ''}`
      }
    >
      <span className="grow truncate">{label}</span>
      {value !== undefined && <span className="shrink-0 truncate text-[11px] opacity-70">{String(value)}</span>}
    </button>
  );
};

export default DemoHistoryEntry;
