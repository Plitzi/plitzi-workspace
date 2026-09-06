import clsx from 'clsx';
import { useNavigate } from 'react-router-dom';

import useAuth from '@pmodules/auth/useAuth';

import useLayout from '../../../useLayout';

export type SidebarFooterProps = { collapsed: boolean };

/**
 * Who is signed in, and the way out.
 *
 * The 2023 footer was mostly an "Upgrade Now" card with a link to `/` and a button to `/#`, plus a dropdown of
 * eight items of which two did anything. What survives is what this window can actually do: say who you are, and
 * sign out.
 */
const SidebarFooter = ({ collapsed }: SidebarFooterProps) => {
  const { user, logout } = useAuth();
  const { toggleSidebar } = useLayout();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    await navigate('/');
  };

  return (
    <div className="shrink-0 border-t border-zinc-800 bg-zinc-900 p-2">
      {collapsed && (
        <button
          type="button"
          title="Expand the sidebar"
          aria-label="Expand the sidebar"
          className="mb-1 w-full rounded p-2 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200"
          onClick={toggleSidebar}
        >
          <i className="fa-solid fa-angles-right text-xs" />
        </button>
      )}
      {user && (
        <div className={clsx('flex items-center gap-2', { 'justify-center': collapsed })}>
          <span
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-zinc-700 text-xs font-bold text-zinc-200 uppercase"
            title={user.username}
          >
            {user.username.slice(0, 1)}
          </span>
          {!collapsed && (
            <div className="min-w-0 grow">
              <div className="truncate text-sm text-zinc-200">{user.username}</div>
              <div className="truncate text-xs text-zinc-500">{user.email}</div>
            </div>
          )}
          <button
            type="button"
            title="Sign out"
            aria-label="Sign out"
            className={clsx('rounded p-2 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200', { hidden: collapsed })}
            onClick={() => void handleLogout()}
          >
            <i className="fa-solid fa-right-from-bracket text-xs" />
          </button>
        </div>
      )}
    </div>
  );
};

export default SidebarFooter;
