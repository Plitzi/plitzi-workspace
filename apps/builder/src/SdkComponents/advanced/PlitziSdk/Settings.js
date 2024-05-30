// Packages
import React from 'react';
import noop from 'lodash/noop';
import Select from '@plitzi/plitzi-ui-components/Select';
import Input from '@plitzi/plitzi-ui-components/Input';

/**
 * @param {{
 *   spaceKey?: string;
 *   environment?: string;
 *   onUpdate?: (key: string, value: any) => void;
 * }} props
 * @returns {React.ReactElement}
 */
const Settings = props => {
  const { spaceKey = '', environment = 'main', onUpdate = noop } = props;

  const handleChange = key => e => onUpdate(key, e.target.value);

  return (
    <div className="flex flex-col">
      <div className="bg-blue-400 px-4 py-2 flex items-center justify-center">
        <h1 className="text-white m-0">Plitzi Sdk Settings</h1>
      </div>
      <div className="flex flex-col p-2">
        <div className="flex flex-col mt-2">
          <label>Space Key</label>
          <Input value={spaceKey} onChange={handleChange('spaceKey')} inputClassName="rounded" />
        </div>
        <div className="flex flex-col mt-2">
          <label>Environment</label>
          <Select value={environment} onChange={handleChange('environment')} inputClassName="rounded">
            <option value="main">Main</option>
            <option value="development">Development</option>
            <option value="staging">Staging</option>
            <option value="live">Live</option>
          </Select>
        </div>
      </div>
    </div>
  );
};

export default Settings;
