import ResizableSidebar from '../../../../../ResizableSidebar';

import type { ReactNode } from 'react';

export type SidebarShellProps = {
  children: ReactNode;
};

// The resizable column that hosts the tracing detail panel (whether it shows a selected element or the empty hint).
// Width persists across both ranked/flamegraph views and panel open/close.
const SidebarShell = ({ children }: SidebarShellProps) => (
  <ResizableSidebar
    storageKey="plitzi-sdk.dev-tools.tracing.sidebar-width"
    minWidth={180}
    maxWidth={480}
    defaultWidth={224}
  >
    {children}
  </ResizableSidebar>
);

export default SidebarShell;
