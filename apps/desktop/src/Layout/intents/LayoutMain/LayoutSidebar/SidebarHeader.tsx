import clsx from 'clsx';
import { Link } from 'react-router-dom';

import useLayout from '../../../useLayout';

export type SidebarHeaderProps = { collapsed: boolean };

const SidebarHeader = ({ collapsed }: SidebarHeaderProps) => {
  const { toggleSidebar } = useLayout();

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
      <button
        type="button"
        title={collapsed ? 'Expand the sidebar' : 'Collapse the sidebar'}
        aria-label={collapsed ? 'Expand the sidebar' : 'Collapse the sidebar'}
        className={clsx('rounded p-1 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200', { hidden: collapsed })}
        onClick={toggleSidebar}
      >
        <i className="fa-solid fa-angles-left text-xs" />
      </button>
    </div>
  );
};

export default SidebarHeader;
