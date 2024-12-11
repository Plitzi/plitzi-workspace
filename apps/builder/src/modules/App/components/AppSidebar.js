// Packages
import React, { useCallback, useMemo, useState } from 'react';
import noop from 'lodash/noop';
import Variable from '@plitzi/plitzi-ui/icons/Variable';
import StateManager from '@plitzi/plitzi-ui/icons/StateManager';
import usePopup from '@plitzi/plitzi-ui/Popup/usePopup';
import Sidebar from '@plitzi/plitzi-ui/Sidebar';
import PopupSidebar from '@plitzi/plitzi-ui/Popup/PopupSidebar';
import useCache from '@plitzi/plitzi-ui-components/Cache/useCache';
import PopupSidePanel from '@plitzi/plitzi-ui/Popup/PopupSidePanel';

// Alias
import BuilderTree from '@pmodules/Builder/components/BuilderTree';
import StyleAdvanceEditor from '@pmodules/Style/StyleAdvanceEditor';

// Relatives
import { featureFlag } from '../../../config';

const defaultCache = [];
const popupSidebarExcluded = ['layerManager', 'advanceStyle', 'stateManager'];

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
  const { existsPopup, addPopup } = usePopup('left');
  const [, setCache, getCacheByKey] = useCache();
  const [popupsActiveLeft, setPopupsActiveLeft] = useState(
    getCacheByKey('PopupSidePanel.popupsActive.left', defaultCache)
  );

  const handleChangeLeft = useCallback(
    popups => {
      setCache(
        popups.filter(popup => !popupSidebarExcluded.includes(popup)),
        'PopupSidePanel.popupsActive.left'
      );
      setPopupsActiveLeft(popups);
    },
    [setCache]
  );

  const handleClickLayerManayer = useCallback(
    e => {
      e.stopPropagation();
      if (!existsPopup('layerManager')) {
        addPopup('layerManager', <BuilderTree />, {
          icon: <i className="fa-solid fa-layer-group text-base" />,
          title: 'Layer Manager',
          allowLeftSide: true,
          allowRightSide: true,
          placement: 'left',
          resizeHandles: ['se']
        });
      } else {
        setPopupsActiveLeft(state => {
          if (state.includes('layerManager')) {
            return state.filter(pop => pop !== 'layerManager');
          }

          return [...state, 'layerManager'];
        });
      }
    },
    [addPopup, existsPopup]
  );

  const handleClickAdvanceStyle = useCallback(
    e => {
      e.stopPropagation();
      if (!existsPopup('advanceStyle')) {
        addPopup('advanceStyle', <StyleAdvanceEditor />, {
          icon: <i className="fa-solid fa-file-code text-base" />,
          title: 'Advance Style',
          resizeHandles: ['se'],
          height: 400,
          width: 600,
          allowLeftSide: true,
          allowRightSide: true,
          placement: 'left'
        });
      } else {
        setPopupsActiveLeft(state => {
          if (state.includes('advanceStyle')) {
            return state.filter(pop => pop !== 'advanceStyle');
          }

          return [...state, 'advanceStyle'];
        });
      }
    },
    [addPopup, existsPopup]
  );

  const handleClickStateManager = useCallback(
    e => {
      e.stopPropagation();
      if (!existsPopup('stateManager')) {
        addPopup('stateManager', <StateManager />, {
          icon: <i className="fa-solid fa-sliders text-base" />,
          title: 'State Manager',
          allowLeftSide: true,
          allowRightSide: true,
          placement: 'left',
          resizeHandles: ['se']
        });
      } else {
        setPopupsActiveLeft(state => {
          if (state.includes('stateManager')) {
            return state.filter(pop => pop !== 'stateManager');
          }

          return [...state, 'stateManager'];
        });
      }
    },
    [addPopup, existsPopup]
  );

  const handleChange = useCallback(items => onSelect(items?.[0] ?? ''), [onSelect]);

  const popupsActiveLeftFiltered = useMemo(
    () => popupsActiveLeft.filter(popupActive => !popupSidebarExcluded.includes(popupActive)),
    [popupsActiveLeft]
  );

  return (
    <>
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
        <Sidebar.Icon
          icon="fa-solid fa-layer-group"
          onClick={handleClickLayerManayer}
          title="Layers"
          detatched
          active={popupsActiveLeft.includes('layerManager')}
        />
        <Sidebar.Icon
          icon="fa-solid fa-file-code"
          onClick={handleClickAdvanceStyle}
          title="Advance Style"
          detatched
          active={popupsActiveLeft.includes('advanceStyle')}
        />
        <Sidebar.Icon
          className="p-2"
          onClick={handleClickStateManager}
          title="State Manager"
          detatched
          active={popupsActiveLeft.includes('stateManager')}
        >
          <StateManager />
        </Sidebar.Icon>
        {popupsActiveLeftFiltered.length > 0 && (
          <>
            <Sidebar.Separator />
            <PopupSidebar
              padding="none"
              placement="left"
              value={popupsActiveLeft}
              onChange={handleChangeLeft}
              exclude={popupSidebarExcluded}
            />
          </>
        )}
        <Sidebar.Separator />
        <Sidebar.Icon id="settings" icon="fas fa-cog" title="Settings" />
      </Sidebar>
      <PopupSidePanel
        showSidebar={false}
        className="overflow-y-auto max-h-[calc(_100vh_-_48px)]"
        placementTabs="left"
        placement="left"
        minWidth={335}
        maxWidth={540}
        canHide
        multiSelect
        value={popupsActiveLeft}
        onChange={handleChangeLeft}
      />
    </>
  );
};

export default AppSidebar;
