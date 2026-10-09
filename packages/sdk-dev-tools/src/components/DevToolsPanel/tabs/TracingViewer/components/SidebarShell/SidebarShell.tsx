import ResizableSidebar from '../../../../../ResizableSidebar';
import DetailSidebar from '../DetailSidebar';
import SidebarEmpty from './SidebarEmpty';

import type { FlameModel, FlameNode } from '../../helpers';
import type { CommitEntry } from '@plitzi/sdk-shared';

export type SidebarShellProps = {
  /** The element picked in the view, if any: without one, the hint to pick one. */
  active?: FlameNode;
  commit: CommitEntry;
  model: FlameModel;
};

// The resizable column that hosts the tracing detail panel (whether it shows a selected element or the empty hint).
// Width persists across both ranked/flamegraph views and panel open/close.
const SidebarShell = ({ active, commit, model }: SidebarShellProps) => (
  <ResizableSidebar
    storageKey="plitzi-sdk.dev-tools.tracing.sidebar-width"
    minWidth={180}
    maxWidth={480}
    defaultWidth={224}
  >
    {active && <DetailSidebar node={active} commit={commit} model={model} />}
    {!active && <SidebarEmpty />}
  </ResizableSidebar>
);

export default SidebarShell;
