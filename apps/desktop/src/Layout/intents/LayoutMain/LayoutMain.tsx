import clsx from 'clsx';

import LayoutSidebar from './LayoutSidebar';

import type { ReactNode } from 'react';

export type LayoutMainProps = {
  children?: ReactNode;
  className?: string;
  pageClassName?: string;
};

/**
 * The signed-in window: a sidebar, and everything else is the page.
 *
 * There is no header, deliberately. A rendered space is the whole product here and every row of chrome above it is
 * a row it does not get — so the window is shaped the way a desktop application is, with one persistent rail and
 * the content filling the rest, rather than the way a website is.
 *
 * What the header used to hold is now where it belongs: which space is open is said by the sidebar highlighting it
 * and by the window's own title, and whether the list is current — which matters, because this app can be open on
 * a machine that is offline and a stale list looks exactly like an empty account — is said next to the list itself.
 *
 * `h-full` rather than `h-screen`: the window is the viewport here, and `h-screen` measures the screen — on a
 * window shorter than the display that is a page taller than what can be seen, with the sidebar's own footer
 * below the bottom edge.
 */
const LayoutMain = ({ children, className, pageClassName }: LayoutMainProps) => (
  <div className={clsx('flex h-full grow overflow-hidden bg-zinc-50 dark:bg-zinc-950', className)}>
    <LayoutSidebar />
    <main className={clsx('flex min-h-0 min-w-0 grow basis-0 flex-col overflow-y-auto', pageClassName)}>
      {children}
    </main>
  </div>
);

export default LayoutMain;
