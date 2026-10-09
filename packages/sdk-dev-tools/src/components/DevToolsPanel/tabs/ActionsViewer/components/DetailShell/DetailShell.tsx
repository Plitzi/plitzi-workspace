import ResizableSidebar from '../../../../../ResizableSidebar';

import type { ReactNode } from 'react';

export type DetailShellProps = {
  children: ReactNode;
};

/** The resizable column the selected run is inspected in; its width is remembered across sessions. */
const DetailShell = ({ children }: DetailShellProps) => (
  <ResizableSidebar
    storageKey="plitzi-sdk.dev-tools.actions.detail-width"
    minWidth={200}
    maxWidth={520}
    defaultWidth={280}
  >
    {children}
  </ResizableSidebar>
);

export default DetailShell;
