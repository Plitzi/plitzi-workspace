// Packages
import React, { useCallback } from 'react';
import noop from 'lodash/noop';
import classNames from 'classnames';
import Icon from '@plitzi/plitzi-ui/Icon';
import Variable from '@plitzi/plitzi-ui/icons/Variable';
import StateManager from '@plitzi/plitzi-ui/icons/StateManager';
import usePopup from '@plitzi/plitzi-ui-components/Popup/usePopup';
import { POPUP_PLACEMENT_LEFT } from '@plitzi/plitzi-ui-components/Popup/PopupProvider';

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

  const handleClick = useCallback(
    item => () => {
      if (selected === item) {
        onSelect(undefined);
      } else {
        onSelect(item);
      }
    },
    [onSelect, selected]
  );

  const handleClickLayerManayer = useCallback(() => {
    if (!existsPopup('layerManager')) {
      addPopup('layerManager', <BuilderTree />, {
        icon: <i className="fas fa-stream text-base" />,
        title: 'Layer Manager',
        allowLeftSide: true,
        allowRightSide: true,
        placement: POPUP_PLACEMENT_LEFT,
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
        placement: POPUP_PLACEMENT_LEFT
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
        placement: POPUP_PLACEMENT_LEFT,
        resizeHandles: ['se']
      });
    }
  }, [addPopup, existsPopup]);

  return (
    <div
      className={classNames(
        'flex flex-col gap-5 py-4 border-r border-gray-200 border-solid bg-white w-14 items-center overflow-y-auto shrink-0',
        className
      )}
    >
      <Icon
        className="h-10 w-10 rounded-lg shrink-0"
        size="lg"
        cursor="pointer"
        intent="tertiary"
        active={selected === 'elements'}
        icon="fa-solid fa-plus"
        onClick={handleClick('elements')}
        title="Elements"
      />
      {/* <Icon
        className="h-10 w-10 rounded-lg shrink-0"
        size="lg"
        cursor="pointer"
        intent="tertiary"
        active={selected === 'elements'}
        icon="fa-solid fa-sitemap"
        onClick={handleClick('sitemap')}
        title="Sitemap"
      /> */}
      <Icon
        className="h-10 w-10 rounded-lg shrink-0"
        size="lg"
        cursor="pointer"
        intent="tertiary"
        active={selected === 'pages'}
        icon="fas fa-file"
        onClick={handleClick('pages')}
        title="Pages"
      />
      {featureFlag.variables && (
        <Icon
          className="h-10 w-10 p-2 rounded-lg shrink-0"
          size="lg"
          cursor="pointer"
          intent="tertiary"
          active={selected === 'variables'}
          onClick={handleClick('variables')}
          title="Variables"
        >
          <Variable />
        </Icon>
      )}
      <Icon
        className="h-10 w-10 p-2 rounded-lg shrink-0"
        size="lg"
        cursor="pointer"
        intent="tertiary"
        active={selected === 'assets'}
        icon="fa-solid fa-image"
        onClick={handleClick('assets')}
        title="Assets"
      />
      <Icon
        className="h-10 w-10 p-2 rounded-lg shrink-0"
        size="lg"
        cursor="pointer"
        intent="tertiary"
        active={selected === 'collections'}
        icon="fas fa-database"
        onClick={handleClick('collections')}
        title="Collections"
      />
      <Icon
        className="h-10 w-10 p-2 rounded-lg shrink-0"
        size="lg"
        cursor="pointer"
        intent="tertiary"
        active={selected === 'segments'}
        icon="fa-solid fa-diamond"
        onClick={handleClick('segments')}
        title="Segments"
      />
      <Icon
        className="h-10 w-10 p-2 rounded-lg shrink-0"
        size="lg"
        cursor="pointer"
        intent="tertiary"
        active={selected === 'segments'}
        icon="fa-solid fa-clone"
        onClick={handleClick('templates')}
        title="Templates"
      />
      {/* <Icon
        className="h-10 w-10 p-2 rounded-lg shrink-0"
        size="lg"
        cursor="pointer"
        intent="tertiary"
        active={selected === 'integrations'}
        icon="fa-solid fa-sliders"
        onClick={handleClick('integrations')}
        title="integrations"
      /> */}
      {/* <Icon
        className="h-10 w-10 p-2 rounded-lg shrink-0"
        size="lg"
        cursor="pointer"
        intent="tertiary"
        active={selected === 'marketplace'}
        icon="fa-solid fa-store"
        onClick={handleClick('marketplace')}
        title="Marketplace"
      /> */}
      <div className="w-6 bg-gray-200 h-px shrink-0" />
      <Icon
        className="h-10 w-10 p-2 rounded-lg shrink-0"
        size="lg"
        cursor="pointer"
        intent="tertiary"
        icon="fa-solid fa-layer-group"
        onClick={handleClickLayerManayer}
        title="Layers"
      />
      <Icon
        className="h-10 w-10 p-2 rounded-lg shrink-0"
        size="lg"
        cursor="pointer"
        intent="tertiary"
        icon="fa-solid fa-file-code"
        onClick={handleClickAdvanceStyle}
        title="ADvance Style"
      />
      <Icon
        className="h-10 w-10 p-2 rounded-lg shrink-0"
        size="lg"
        cursor="pointer"
        intent="tertiary"
        onClick={handleClickStateManager}
        title="State Manager"
      >
        <StateManager />
      </Icon>
      <div className="w-6 bg-gray-200 h-px shrink-0" />
      <Icon
        className="h-10 w-10 p-2 rounded-lg shrink-0"
        size="lg"
        cursor="pointer"
        intent="tertiary"
        active={selected === 'settings'}
        icon="fas fa-cog"
        onClick={handleClick('settings')}
        title="Settings"
      />
    </div>
  );
};

export default AppSidebar;
