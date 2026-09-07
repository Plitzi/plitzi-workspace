import clsx from 'clsx';
import { Link } from 'react-router-dom';

import useSpaces from '@pmodules/spaces/useSpaces';

import useLayout from '../../../useLayout';

export type SidebarHeaderProps = { collapsed: boolean };

/**
 * The brand, and the two controls that used to live in a header of their own.
 *
 * Refreshing belongs beside the list it refreshes, not above the page: what it reloads is the spaces below it, and
 * nothing else on screen changes. Which space is open is not said here at all — the list says it by highlighting
 * one, and the window title says it again.
 */
const SidebarHeader = ({ collapsed }: SidebarHeaderProps) => {
  const { toggleSidebar } = useLayout();
  const { loading, reload } = useSpaces();

  return (
    <div
      className={clsx('flex h-12 shrink-0 items-center border-b border-zinc-800 bg-zinc-900', {
        'justify-between px-3': !collapsed,
        'justify-center px-2': collapsed
      })}
    >
      <Link to="/" title="Your spaces" className="flex items-center gap-2 text-white">
        <img src="https://cdn.plitzi.com/resources/img/favicon.svg" alt="" className="h-6 w-6" />
        {!collapsed && <span className="text-lg font-bold">Plitzi</span>}
      </Link>
      <div className={clsx('flex items-center gap-1', { hidden: collapsed })}>
        <button
          type="button"
          title="Refresh your spaces"
          aria-label="Refresh your spaces"
          className="rounded p-1 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200 disabled:opacity-50"
          disabled={loading}
          onClick={() => void reload()}
        >
          <i className={clsx('fa-solid fa-rotate-right text-xs', { 'animate-spin': loading })} />
        </button>
        <button
          type="button"
          title="Collapse the sidebar"
          aria-label="Collapse the sidebar"
          className="rounded p-1 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200"
          onClick={toggleSidebar}
        >
          <i className="fa-solid fa-angles-left text-xs" />
        </button>
      </div>
    </div>
  );
};

export default SidebarHeader;
