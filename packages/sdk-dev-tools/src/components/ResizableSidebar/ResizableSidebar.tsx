import ContainerResizable from '@plitzi/plitzi-ui/ContainerResizable';
import useStorage from '@plitzi/plitzi-ui/hooks/useStorage';
import { useCallback } from 'react';

import type { ReactNode } from 'react';

export type ResizableSidebarProps = {
  /** Where its width is remembered, across sessions and the panel opening and closing. */
  storageKey: string;
  minWidth: number;
  maxWidth: number;
  defaultWidth: number;
  children: ReactNode;
};

/** A column at a tab's right edge, resized from its left border. */
const ResizableSidebar = ({ storageKey, minWidth, maxWidth, defaultWidth, children }: ResizableSidebarProps) => {
  const [width, setWidth] = useStorage(storageKey, defaultWidth);
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
      minConstraintsX={minWidth}
      maxConstraintsX={maxWidth}
      onChange={handleResize}
    >
      <aside className="flex h-full w-full flex-col gap-1.5 overflow-auto bg-zinc-50 px-3 py-2 text-[10px] dark:bg-zinc-900/50">
        {children}
      </aside>
    </ContainerResizable>
  );
};

export default ResizableSidebar;
