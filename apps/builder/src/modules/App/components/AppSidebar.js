// Packages
import React, { useCallback } from 'react';
import noop from 'lodash/noop';
import Variable from '@plitzi/plitzi-ui/icons/Variable';
import StateManager from '@plitzi/plitzi-ui/icons/StateManager';
import usePopup from '@plitzi/plitzi-ui/Popup/usePopup';
import Sidebar from '@plitzi/plitzi-ui/Sidebar';

// Alias
import BuilderTree from '@pmodules/Builder/components/BuilderTree';
import StyleAdvanceEditor from '@pmodules/Style/StyleAdvanceEditor';

// Relatives
import { featureFlag } from '../../../config';

/**
 * @param {{
 *   className?: string;
 *   selected?: string;
 *   onSelect?: (item: string) => void;
 * }} props
 * @returns {React.ReactElement}
 */
const AppSidebar = props => {
  const { className = '', selected = '', onSelect = noop } = props;
  const { existsPopup, addPopup } = usePopup();

  const handleClickLayerManayer = useCallback(() => {
    if (!existsPopup('layerManager')) {
      addPopup('layerManager', <BuilderTree />, {
        icon: <i className="fas fa-stream text-base" />,
        title: 'Layer Manager',
        allowLeftSide: true,
        allowRightSide: true,
        placement: 'left',
        resizeHandles: ['se']
      });
    }
  }, [addPopup, existsPopup]);

  const handleClickAdvanceStyle = useCallback(() => {
    if (!existsPopup('advance-style')) {
      addPopup('advance-style', <StyleAdvanceEditor />, {
        icon: <i className="fas fa-code text-base" />,
        title: 'Advance Style',
        resizeHandles: ['se'],
        height: 400,
        width: 600,
        allowLeftSide: true,
        allowRightSide: true,
        placement: 'left'
      });
    }
  }, [addPopup, existsPopup]);

  const handleClickStateManager = useCallback(() => {
    if (!existsPopup('stateManager')) {
      addPopup('stateManager', <StateManager />, {
        icon: <i className="fa-solid fa-sliders text-base" />,
        title: 'State Manager',
        allowLeftSide: true,
        allowRightSide: true,
        placement: 'left',
        resizeHandles: ['se']
      });
    }
  }, [addPopup, existsPopup]);

  const handleChange = useCallback(items => onSelect(items?.[0] ?? ''), [onSelect]);

  return (
    <Sidebar className={className} value={selected} onChange={handleChange} canEmpty>
      <Sidebar.Icon id="elements" icon="fa-solid fa-plus" title="Elements" />
      <Sidebar.Icon id="pages" icon="fas fa-file" title="Pages" />
      {featureFlag.variables && (
        <Sidebar.Icon className="p-2" id="variables" title="Variables">
          <Variable />
        </Sidebar.Icon>
      )}
      <Sidebar.Icon id="assets" icon="fa-solid fa-image" title="Assets" />
      <Sidebar.Icon id="collections" icon="fas fa-database" title="Collections" />
      <Sidebar.Icon id="segments" icon="fa-solid fa-diamond" title="Segments" />
      <Sidebar.Icon id="templates" icon="fa-solid fa-clone" title="Templates" />
      {/* <Sidebar.Icon id="integrations" icon="fa-solid fa-sliders" title="integrations" /> */}
      {/* <Sidebar.Icon id="marketplace" icon="fa-solid fa-store" title="Marketplace" /> */}
      <Sidebar.Separator />
      <Sidebar.Icon icon="fa-solid fa-layer-group" onClick={handleClickLayerManayer} title="Layers" />
      <Sidebar.Icon icon="fa-solid fa-file-code" onClick={handleClickAdvanceStyle} title="ADvance Style" />
      <Sidebar.Icon className="p-2" onClick={handleClickStateManager} title="State Manager">
        <StateManager />
      </Sidebar.Icon>
      <Sidebar.Separator />
      <Sidebar.Icon id="settings" icon="fas fa-cog" title="Settings" />
    </Sidebar>
  );
};

export default AppSidebar;
