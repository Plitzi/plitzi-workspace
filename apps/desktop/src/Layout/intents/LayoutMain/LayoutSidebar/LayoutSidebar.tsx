import clsx from 'clsx';
import { NavLink } from 'react-router-dom';

import useSpaces from '@pmodules/spaces/useSpaces';

import SidebarFooter from './SidebarFooter';
import SidebarHeader from './SidebarHeader';
import useLayout from '../../../useLayout';

import type { Space } from '@pmodules/spaces';

const SpaceLink = ({ space, collapsed }: { space: Space; collapsed: boolean }) => (
  <NavLink
    to={`/spaces/view/${space.permanentUrl}`}
    title={space.name}
    className={({ isActive }) =>
      clsx('flex items-center gap-3 rounded px-2 py-2 text-sm', {
        'bg-zinc-700 text-white': isActive,
        'text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200': !isActive,
        'justify-center': collapsed
      })
    }
  >
    {({ isActive }) => (
      <>
        <span
          className={clsx('flex h-6 w-6 shrink-0 items-center justify-center rounded text-xs font-bold uppercase', {
            'bg-indigo-500 text-white': isActive,
            'bg-zinc-600 text-zinc-200': !isActive
          })}
        >
          {space.name.slice(0, 1)}
        </span>
        {!collapsed && <span className="truncate">{space.name}</span>}
      </>
    )}
  </NavLink>
);

const Separator = ({ label, collapsed }: { label: string; collapsed: boolean }) =>
  collapsed ? (
    <div className="my-2 h-px bg-zinc-700" />
  ) : (
    <div className="my-2 flex items-center gap-3 text-[10px] font-bold tracking-wider text-zinc-500">
      <span className="h-px grow bg-zinc-700" />
      {label}
      <span className="h-px grow bg-zinc-700" />
    </div>
  );

/**
 * The spaces this account can reach, as navigation.
 *
 * Every item is a `NavLink`, so which one is open is decided by the URL rather than by an `activeSpace` compared
 * by id — the 2023 sidebar had to be told, and a deep link opened on start-up never told it.
 */
const LayoutSidebar = () => {
  const { sidebarVisible } = useLayout();
  const { owned, guest, loading, error } = useSpaces();
  const collapsed = !sidebarVisible;

  return (
    <nav
      className={clsx('flex shrink-0 flex-col bg-zinc-900 transition-[width] duration-150', {
        'w-[264px]': !collapsed,
        'w-14': collapsed
      })}
    >
      <SidebarHeader collapsed={collapsed} />
      <div className={clsx('flex min-h-0 grow flex-col gap-1 overflow-y-auto py-2', collapsed ? 'px-2' : 'px-3')}>
        {loading && owned.length === 0 && guest.length === 0 && (
          <div className={clsx('px-2 py-3 text-xs text-zinc-500', { hidden: collapsed })}>Loading your spaces…</div>
        )}
        {!loading && error === undefined && owned.length === 0 && guest.length === 0 && (
          <div className={clsx('px-2 py-3 text-xs text-zinc-500', { hidden: collapsed })}>
            No spaces yet. Create one at plitzi.com and it will show up here.
          </div>
        )}
        {owned.map(space => (
          <SpaceLink key={space.id} space={space} collapsed={collapsed} />
        ))}
        {guest.length > 0 && <Separator label="SHARED WITH ME" collapsed={collapsed} />}
        {guest.map(space => (
          <SpaceLink key={space.id} space={space} collapsed={collapsed} />
        ))}
      </div>
      <SidebarFooter collapsed={collapsed} />
    </nav>
  );
};

export default LayoutSidebar;
