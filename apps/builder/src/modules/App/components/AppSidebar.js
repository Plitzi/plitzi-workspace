// Packages
import React, { useCallback, useState } from 'react';
import useCache from '@plitzi/plitzi-ui-components/Cache/useCache';
import PopupSidePanel from '@plitzi/plitzi-ui/Popup/PopupSidePanel';

const defaultCache = [];
const popupSidebarExcluded = ['collections', 'settings'];
const separatorsBefore = ['layerManager', 'settings'];

/**
 * @param {{
 *   className?: string;
 *   selected?: string;
 *   onSelect?: (item: string) => void;
 * }} props
 * @returns {React.ReactElement}
 */
const AppSidebar = props => {
  const { onSelect } = props;
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
      onSelect?.(popups?.[0] ?? '');
    },
    [setCache, onSelect]
  );

  return (
    <PopupSidePanel
      size="md"
      className="overflow-y-auto max-h-[calc(_100vh_-_48px)]"
      placementTabs="left"
      placement="left"
      separatorsBefore={separatorsBefore}
      minWidth={335}
      maxWidth={540}
      canHide
      value={popupsActiveLeft}
      onChange={handleChangeLeft}
    />
  );
};

export default AppSidebar;
