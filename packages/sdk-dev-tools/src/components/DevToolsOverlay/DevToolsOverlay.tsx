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
};

// What the dev tools show at any moment: the floating badge while collapsed, the docked panel while open. The two are
// mutually exclusive — the panel carries its own way back to the badge — so they share one prop list here instead of
// being placed twice by every render mode of the container. The QA tools' layer is here too, under both: what a tester
// turned on stays on with the panel folded away.
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
  pageRef
}: DevToolsOverlayProps) => {
  return (
    <QaProvider pageRef={pageRef}>
      <QaLayer />
      {collapsed && <DevToolsIndicator className={className} onOpen={onOpen} />}
      {!collapsed && (
        <DevToolsPanel
          className={className}
          orientation={orientation}
          tabSelected={tabSelected}
          logTypeFilter={logTypeFilter}
          onCollapse={onCollapse}
          onTabSelect={onTabSelect}
          onChangeOrientation={onChangeOrientation}
        />
      )}
    </QaProvider>
  );
};

export default DevToolsOverlay;
