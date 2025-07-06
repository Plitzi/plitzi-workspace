// Packages
import React, { useCallback, useState } from 'react';
import PopupSidePanel from '@plitzi/plitzi-ui/Popup/PopupSidePanel';
import useStorage from '@plitzi/plitzi-ui/hooks/useStorage';

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
  const [popupsActiveLeft, setPopupsActiveLeft] = useStorage('builder-state.popupSidePanel.popupsActive.left', []); // <string[]>

  const handleChangeLeft = useCallback(
    popups => {
      setPopupsActiveLeft(popups);
      onSelect?.(popups?.[0] ?? '');
    },
    [setPopupsActiveLeft, onSelect]
  );

  return (
    <PopupSidePanel
      size="md"
      className="max-h-[calc(_100vh_-_48px)] overflow-y-auto"
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
