import { QaProvider } from '../../qa/QaContext';
import QaLayer from '../../qa/QaLayer';
import DevToolsIndicator from '../DevToolsIndicator';
import DevToolsPanel from '../DevToolsPanel';

import type { Orientation } from '../../DevToolsContainer';
import type { LogType } from '@plitzi/sdk-shared';
import type { RefObject } from 'react';

export type DevToolsOverlayProps = {
  className?: string;
  collapsed: boolean;
  orientation: Orientation;
  tabSelected: string;
  logTypeFilter?: LogType;
  onOpen: (logType?: LogType) => void;
  onCollapse: () => void;
  onTabSelect: (tabSelected: string) => void;
  onChangeOrientation: (orientation: Orientation) => void;
  /** The page's own box, which the QA tools draw over and look in. */
  pageRef: RefObject<HTMLElement | null>;
  /** Whether the QA tab and its layer are offered: only over a page — see `DevToolsContainer`. */
  qa: boolean;
};

// What the dev tools show at any moment: the floating badge while collapsed, the docked panel while open. The two are
// mutually exclusive — the panel carries its own way back to the badge — so they share one prop list here instead of
// being placed twice by every render mode of the container. The QA tools' layer is here too, under both: the views a
// tester turned on stay with the panel folded away; the inspector and the checks stop with it.
const DevToolsOverlay = ({
  className,
  collapsed,
  orientation,
  tabSelected,
  logTypeFilter,
  onOpen,
  onCollapse,
  onTabSelect,
  onChangeOrientation,
  pageRef,
  qa
}: DevToolsOverlayProps) => {
  const shown = (
    <>
      {collapsed && <DevToolsIndicator className={className} onOpen={onOpen} />}
      {!collapsed && (
        <DevToolsPanel
          className={className}
          orientation={orientation}
          tabSelected={tabSelected}
          logTypeFilter={logTypeFilter}
          qa={qa}
          onCollapse={onCollapse}
          onTabSelect={onTabSelect}
          onChangeOrientation={onChangeOrientation}
        />
      )}
    </>
  );
  if (!qa) {
    return shown;
  }

  return (
    <QaProvider pageRef={pageRef} collapsed={collapsed}>
      <QaLayer />
      {shown}
    </QaProvider>
  );
};

export default DevToolsOverlay;
