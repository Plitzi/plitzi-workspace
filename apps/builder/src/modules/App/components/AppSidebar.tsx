import useStorage from '@plitzi/plitzi-ui/hooks/useStorage';
import { PopupSidePanel } from '@plitzi/plitzi-ui/Popup';
import { useCallback } from 'react';

import type { Dispatch, SetStateAction } from 'react';

const separatorsBefore = ['layerManager', 'settings'];

export type AppSidebarProps = {
  onSelect?: Dispatch<SetStateAction<string>>;
};

const AppSidebar = ({ onSelect }: AppSidebarProps) => {
  const [popupsActiveLeft, setPopupsActiveLeft] = useStorage<string[]>(
    'builder-state.popupSidePanel.popupsActive.left',
    []
  );

  const handleChangeLeft = useCallback(
    (popups: string[]) => {
      setPopupsActiveLeft(popups);
      onSelect?.(popups[0]);
    },
    [setPopupsActiveLeft, onSelect]
  );

  return (
    <PopupSidePanel
      size="md"
      className="max-h-[calc(100vh-48px)] overflow-y-auto"
      placementTabs="left"
      placement="left"
      separatorsBefore={separatorsBefore}
      minWidth={335}
      maxWidth={800}
      canHide
      multi
      value={popupsActiveLeft}
      onChange={handleChangeLeft}
    />
  );
};

export default AppSidebar;
