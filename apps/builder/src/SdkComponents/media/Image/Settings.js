// Packages
import React from 'react';
import noop from 'lodash/noop';
import Select from '@plitzi/plitzi-ui-components/Select';
import Input from '@plitzi/plitzi-ui-components/Input';

/**
 * @param {{
 *   src?: string;
 *   loadMode?: string;
 * }} props
 * @returns {React.ReactElement}
 */
const Settings = props => {
  const { src = '', loadMode = 'auto', onUpdate = noop } = props;

  const handleChange = key => e => onUpdate(key, e.target.value);

  return (
    <div className="flex flex-col">
      <div className="bg-blue-400 px-4 py-2 flex items-center justify-center">
        <h1 className="text-white m-0">Image Settings</h1>
      </div>
      <div className="flex flex-col p-2">
        <div className="flex flex-col">
          <label>Image</label>
          <div className="flex flex-col">
            <span>URL</span>
            <Input value={src} onChange={handleChange('src')} inputClassName="rounded-sm" />
            {src && (
              <div className="flex items-center justify-center p-2 mt-2 border rounded-sm border-gray-300 relative">
                <div className="bg-white text-xs absolute top-2 left-2 p-1 rounded-br rounded-tl border border-gray-300">
                  Preview
                </div>
                <img src={src} alt="" className="w-full h-full rounded-sm" />
              </div>
            )}
          </div>
        </div>
        <div className="flex flex-col mt-4">
          <label>Load Mode</label>
          <Select value={loadMode} onChange={handleChange('loadMode')} className="rounded-sm">
            <option value="auto">Auto</option>
            <option value="lazy">Lazy</option>
            <option value="eager">Eager</option>
          </Select>
        </div>
      </div>
    </div>
  );
};

export default Settings;
