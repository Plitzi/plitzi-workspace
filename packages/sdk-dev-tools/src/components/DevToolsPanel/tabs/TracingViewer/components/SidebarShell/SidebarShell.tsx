import ContainerResizable from '@plitzi/plitzi-ui/ContainerResizable';
import useStorage from '@plitzi/plitzi-ui/hooks/useStorage';
import { useCallback } from 'react';

import type { ReactNode } from 'react';

const SIDEBAR_MIN = 180;
const SIDEBAR_MAX = 480;
const SIDEBAR_DEFAULT = 224;

export type SidebarShellProps = {
  children: ReactNode;
};

// The resizable column that hosts the tracing detail panel (whether it shows a selected element or the empty hint).
// Width persists across both ranked/flamegraph views and panel open/close.
const SidebarShell = ({ children }: SidebarShellProps) => {
  const [width, setWidth] = useStorage('plitzi-sdk.dev-tools.tracing.sidebar-width', SIDEBAR_DEFAULT);
  // Only the width (`w` handle) resizes; the height arrives as Infinity and must not overwrite the stored width.
  const handleResize = useCallback(
    (next: number) => {
      if (Number.isFinite(next)) {
        setWidth(next);
      }
    },
    [setWidth]
  );

  return (
    <ContainerResizable
      className="shrink-0 border-l border-zinc-200 dark:border-zinc-800"
      resizeHandles={['w']}
      axis="x"
      autoGrow={false}
      width={width}
      minConstraintsX={SIDEBAR_MIN}
      maxConstraintsX={SIDEBAR_MAX}
      onChange={handleResize}
    >
      <aside className="flex h-full w-full flex-col gap-1.5 overflow-auto bg-zinc-50 px-3 py-2 text-[10px] dark:bg-zinc-900/50">
        {children}
      </aside>
    </ContainerResizable>
  );
};

export default SidebarShell;
