import ContainerResizable from '@plitzi/plitzi-ui/ContainerResizable';
import useStorage from '@plitzi/plitzi-ui/hooks/useStorage';
import { useCallback } from 'react';

import type { ReactNode } from 'react';

const SIDEBAR_MIN = 200;
const SIDEBAR_MAX = 520;
const SIDEBAR_DEFAULT = 280;

export type DetailShellProps = {
  children: ReactNode;
};

/** The resizable column the selected run is inspected in; its width is remembered across sessions. */
const DetailShell = ({ children }: DetailShellProps) => {
  const [width, setWidth] = useStorage('plitzi-sdk.dev-tools.actions.detail-width', SIDEBAR_DEFAULT);
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

export default DetailShell;
