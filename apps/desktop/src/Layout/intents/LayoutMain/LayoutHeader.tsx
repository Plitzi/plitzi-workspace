import clsx from 'clsx';

import useSpaces from '@pmodules/spaces/useSpaces';

export type LayoutHeaderProps = { className?: string };

/**
 * Says which space is open, and whether the list behind it is current.
 *
 * The 2023 header was two empty flex boxes with a border — real estate reserved for something that was never
 * written. The one fact worth putting there is the one the window cannot show any other way: this app can be
 * open while the machine is offline, and a list that failed to refresh looks exactly like an empty account.
 */
const LayoutHeader = ({ className }: LayoutHeaderProps) => {
  const { activeSpace, loading, error, reload } = useSpaces();

  return (
    <header
      className={clsx(
        'flex h-12 shrink-0 items-center justify-between border-b border-zinc-200 bg-white px-4',
        'dark:border-zinc-800 dark:bg-zinc-900',
        className
      )}
    >
      <div className="truncate text-sm font-semibold text-zinc-700 dark:text-zinc-200">
        {activeSpace ? activeSpace.name : 'Your spaces'}
      </div>
      <div className="flex items-center gap-3 text-xs">
        {error === 'offline' && <span className="text-amber-600 dark:text-amber-400">Offline</span>}
        {error !== undefined && error !== 'offline' && <span className="text-red-600 dark:text-red-400">{error}</span>}
        <button
          type="button"
          className="rounded px-2 py-1 text-zinc-500 hover:bg-zinc-100 hover:text-zinc-800 disabled:opacity-50 dark:hover:bg-zinc-800 dark:hover:text-zinc-200"
          disabled={loading}
          onClick={() => void reload()}
        >
          {loading ? 'Refreshing…' : 'Refresh'}
        </button>
      </div>
    </header>
  );
};

export default LayoutHeader;
