// Packages
import React from 'react';
import noop from 'lodash/noop';
import Select from '@plitzi/plitzi-ui-components/Select';

/**
 * @param {{
 *   subType?: 'ul' | 'ol';
 *   source?: 'none' | 'controlled';
 *   onUpdate?: (key: string, value: any) => void;
 * }} props
 * @returns {React.ReactElement}
 */
const Settings = props => {
  const { subType = 'ul', source = 'none', onUpdate = noop } = props;

  const handleChange = key => e => onUpdate(key, e.target.value);

  return (
    <div className="flex flex-col">
      <div className="bg-blue-400 px-4 py-2 flex items-center justify-center">
        <h1 className="text-white m-0">List Settings</h1>
      </div>
      <div className="flex flex-col p-2">
        <div className="flex flex-col">
          <label>Source</label>
          <Select value={source} onChange={handleChange('source')} className="rounded">
            <option value="none">None</option>
            <option value="controlled">Controlled</option>
          </Select>
        </div>
        {source === 'none' && (
          <div className="flex flex-col mt-4">
            <label>List Type</label>
            <Select value={subType} onChange={handleChange('subType')} className="rounded">
              <option value="ul">Unordered</option>
              <option value="ol">Ordered</option>
            </Select>
          </div>
        )}
      </div>
    </div>
  );
};

export default Settings;
