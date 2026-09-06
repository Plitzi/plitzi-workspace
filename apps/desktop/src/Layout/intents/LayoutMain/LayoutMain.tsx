import clsx from 'clsx';

import LayoutHeader from './LayoutHeader';
import LayoutSidebar from './LayoutSidebar';
import useLayout from '../../useLayout';

import type { ReactNode } from 'react';

export type LayoutMainProps = {
  children?: ReactNode;
  className?: string;
  pageClassName?: string;
  showHeader?: boolean;
};

/**
 * The signed-in window: a sidebar of spaces, and one scrolling column beside it.
 *
 * `h-full` rather than `h-screen`: the window is the viewport here, and `h-screen` measures the screen — on a
 * window shorter than the display that is a page taller than what can be seen, with the sidebar's own footer
 * below the bottom edge.
 */
const LayoutMain = ({ children, className, pageClassName, showHeader = true }: LayoutMainProps) => {
  const { subHeader } = useLayout();

  return (
    <div className={clsx('flex h-full grow overflow-hidden bg-zinc-50 dark:bg-zinc-950', className)}>
      <LayoutSidebar />
      <div className="flex min-w-0 grow flex-col overflow-hidden">
        {showHeader && <LayoutHeader />}
        {subHeader}
        <main className={clsx('flex min-h-0 grow basis-0 flex-col overflow-y-auto', pageClassName)}>{children}</main>
      </div>
    </div>
  );
};

export default LayoutMain;
