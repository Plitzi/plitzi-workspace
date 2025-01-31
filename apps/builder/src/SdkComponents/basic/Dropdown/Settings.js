// Packages
import React, { useCallback } from 'react';
import noop from 'lodash/noop';
import Input from '@plitzi/plitzi-ui-components/Input';
import Select from '@plitzi/plitzi-ui-components/Select';
import Checkbox from '@plitzi/plitzi-ui-components/Checkbox';

/**
 * @param {{
 *   popupPlacement?: 'top' | 'bottom' | 'left' | 'right';
 *   openPopup?: boolean;
 *   backgroundDisabled?: boolean;
 *   closeOnClickBackground?: boolean;
 *   closeOnClickPopup?: boolean;
 *   containerTopOffset?: number;
 *   containerLeftOffset?: number;
 *   disabled?: boolean;
 *   onUpdate?: (key: string, value: any) => void;
 * }} props
 * @returns {React.ReactElement}
 */
const Settings = props => {
  const {
    popupPlacement = 'bottom',
    openPopup = false,
    backgroundDisabled = false,
    closeOnClickBackground = true,
    closeOnClickPopup = true,
    containerTopOffset = 5,
    containerLeftOffset = 5,
    disabled = false,
    onUpdate = noop
  } = props;

  const handleChangeTopOffset = useCallback(
    e => onUpdate('containerTopOffset', parseFloat(e.target.value)),
    [onUpdate]
  );

  const handleChangeLeftOffset = useCallback(
    e => onUpdate('containerLeftOffset', parseFloat(e.target.value)),
    [onUpdate]
  );

  const handleChangePopupPlacement = useCallback(e => onUpdate('popupPlacement', e.target.value), [onUpdate]);

  const handleChangeOpenPopup = useCallback(e => onUpdate('openPopup', e.target.checked), [onUpdate]);

  const handleChangeBackgroundDisabled = useCallback(e => onUpdate('backgroundDisabled', e.target.checked), [onUpdate]);

  const handleChangeCloseOnClickBackground = useCallback(
    e => onUpdate('closeOnClickBackground', e.target.checked),
    [onUpdate]
  );

  const handleChangeCloseOnClickPopup = useCallback(e => onUpdate('closeOnClickPopup', e.target.checked), [onUpdate]);

  const handleChangeDisabled = useCallback(e => onUpdate('disabled', e.target.checked), [onUpdate]);

  return (
    <div className="flex flex-col">
      <div className="bg-blue-400 px-4 py-2 flex items-center justify-center">
        <h1 className="text-white m-0">Dropdown Settings</h1>
      </div>
      <div className="flex flex-col p-2">
        <div className="flex flex-col">
          <label>Popup Placement</label>
          <Select value={popupPlacement} onChange={handleChangePopupPlacement} className="rounded-sm">
            <option value="top">Top</option>
            <option value="bottom">Bottom</option>
            <option value="left">Left</option>
            <option value="right">Right</option>
          </Select>
        </div>
        <div className="flex flex-col mt-4">
          <label>Container Top Offset</label>
          <Input
            type="number"
            value={containerTopOffset}
            onChange={handleChangeTopOffset}
            inputClassName="rounded-sm"
          />
        </div>
        <div className="flex flex-col mt-4">
          <label>Container Left Offset</label>
          <Input
            type="number"
            value={containerLeftOffset}
            onChange={handleChangeLeftOffset}
            inputClassName="rounded-sm"
          />
        </div>
        <div className="flex items-center mt-4">
          <Checkbox id="open-popup" checked={openPopup} onChange={handleChangeOpenPopup} className="rounded-sm mr-2" />
          <label htmlFor="open-popup" className="cursor-pointer select-none">
            Open Popup
          </label>
        </div>
        <div className="flex items-center mt-4">
          <Checkbox
            id="background-disabled"
            checked={backgroundDisabled}
            onChange={handleChangeBackgroundDisabled}
            className="rounded-sm mr-2"
          />
          <label htmlFor="background-disabled" className="cursor-pointer select-none">
            Disable Background
          </label>
        </div>
        <div className="flex items-center mt-4">
          <Checkbox
            id="close-on-click-background"
            checked={closeOnClickBackground}
            onChange={handleChangeCloseOnClickBackground}
            className="rounded-sm mr-2"
          />
          <label htmlFor="close-on-click-background" className="cursor-pointer select-none">
            Close on click background
          </label>
        </div>
        <div className="flex items-center mt-4">
          <Checkbox
            id="close-on-click-popup"
            checked={closeOnClickPopup}
            onChange={handleChangeCloseOnClickPopup}
            className="rounded-sm mr-2"
          />
          <label htmlFor="close-on-click-popup" className="cursor-pointer select-none">
            Close on click popup
          </label>
        </div>
        <div className="flex items-center mt-4">
          <Checkbox id="disabled" checked={disabled} onChange={handleChangeDisabled} className="rounded-sm mr-2" />
          <label htmlFor="disabled" className="cursor-pointer select-none">
            Disabled
          </label>
        </div>
      </div>
    </div>
  );
};

export default Settings;
