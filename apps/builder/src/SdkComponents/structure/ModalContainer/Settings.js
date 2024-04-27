// Packages
import React from 'react';
import noop from 'lodash/noop';
import Input from '@plitzi/plitzi-ui-components/Input';
import Checkbox from '@plitzi/plitzi-ui-components/Checkbox';

/**
 * @param {{
 *   title?: string;
 *   autoHideAfterClick?: boolean;
 *   onUpdate?: (key: string, value: any) => void;
 * }} props
 * @returns {React.ReactElement}
 */
const Settings = props => {
  const { title = 'Modal Header', autoHideAfterClick = true, onUpdate = noop } = props;

  const handleChange = key => e => onUpdate(key, e.target.value);

  const handleChangeAutoHide = e => onUpdate('autoHideAfterClick', e.target.checked);

  return (
    <div className="flex flex-col">
      <div className="bg-blue-400 px-4 py-2 flex items-center justify-center">
        <h1 className="text-white m-0">Modal Container Settings</h1>
      </div>
      <div className="flex flex-col p-2">
        <div className="flex flex-col">
          <label>Title</label>
          <Input value={title} onChange={handleChange('title')} inputClassName="rounded" />
        </div>
        <div className="flex items-center mt-4">
          <Checkbox
            id="auto-hide-after-click"
            checked={autoHideAfterClick}
            onChange={handleChangeAutoHide}
            className="rounded mr-2"
          />
          <label htmlFor="auto-hide-after-click" className="cursor-pointer select-none">
            Hide after click background
          </label>
        </div>
      </div>
    </div>
  );
};

export default Settings;
