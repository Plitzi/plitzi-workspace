import Checkbox from '@plitzi/plitzi-ui/Checkbox';
import Input from '@plitzi/plitzi-ui/Input';
import Select from '@plitzi/plitzi-ui/Select';
import { useCallback } from 'react';

import type { ChangeEvent } from 'react';

type SettingsProps = {
  popupPlacement?: 'top' | 'bottom' | 'left' | 'right';
  openPopup?: boolean;
  backgroundDisabled?: boolean;
  closeOnClickBackground?: boolean;
  closeOnClickPopup?: boolean;
  containerTopOffset?: number;
  containerLeftOffset?: number;
  disabled?: boolean;
  onUpdate?: (key: string, value: string | boolean | number) => void;
};

const Settings = ({
  popupPlacement = 'bottom',
  openPopup = false,
  backgroundDisabled = false,
  closeOnClickBackground = true,
  closeOnClickPopup = true,
  containerTopOffset = 5,
  containerLeftOffset = 5,
  disabled = false,
  onUpdate
}: SettingsProps) => {
  const handleChangeTopOffset = useCallback(
    (value: string) => onUpdate?.('containerTopOffset', parseFloat(value)),
    [onUpdate]
  );

  const handleChangeLeftOffset = useCallback(
    (value: string) => onUpdate?.('containerLeftOffset', parseFloat(value)),
    [onUpdate]
  );

  const handleChangePopupPlacement = useCallback((value: string) => onUpdate?.('popupPlacement', value), [onUpdate]);

  const handleChangeOpenPopup = useCallback(
    (e: ChangeEvent) => onUpdate?.('openPopup', (e.target as HTMLInputElement).checked),
    [onUpdate]
  );

  const handleChangeBackgroundDisabled = useCallback(
    (e: ChangeEvent) => onUpdate?.('backgroundDisabled', (e.target as HTMLInputElement).checked),
    [onUpdate]
  );

  const handleChangeCloseOnClickBackground = useCallback(
    (e: ChangeEvent) => onUpdate?.('closeOnClickBackground', (e.target as HTMLInputElement).checked),
    [onUpdate]
  );

  const handleChangeCloseOnClickPopup = useCallback(
    (e: ChangeEvent) => onUpdate?.('closeOnClickPopup', (e.target as HTMLInputElement).checked),
    [onUpdate]
  );

  const handleChangeDisabled = useCallback(
    (e: ChangeEvent) => onUpdate?.('disabled', (e.target as HTMLInputElement).checked),
    [onUpdate]
  );

  return (
    <div className="flex h-full flex-col gap-4 py-2">
      <Select value={popupPlacement} label="opup Placement" onChange={handleChangePopupPlacement}>
        <option value="top">Top</option>
        <option value="bottom">Bottom</option>
        <option value="left">Left</option>
        <option value="right">Right</option>
      </Select>
      <Input type="number" label="Container Top Offset" value={containerTopOffset} onChange={handleChangeTopOffset} />
      <Input
        type="number"
        label="Container Left Offset"
        value={containerLeftOffset}
        onChange={handleChangeLeftOffset}
      />
      <Checkbox label="Open Popup" checked={openPopup} onChange={handleChangeOpenPopup} />
      <Checkbox checked={backgroundDisabled} onChange={handleChangeBackgroundDisabled} label=" Disable Background" />
      <Checkbox
        checked={closeOnClickBackground}
        onChange={handleChangeCloseOnClickBackground}
        label="Close on click background"
      />
      <Checkbox checked={closeOnClickPopup} onChange={handleChangeCloseOnClickPopup} label="Close on click popup" />
      <Checkbox checked={disabled} label="Disabled" onChange={handleChangeDisabled} />
    </div>
  );
};

export default Settings;
