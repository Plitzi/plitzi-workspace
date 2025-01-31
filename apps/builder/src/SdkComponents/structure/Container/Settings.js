// Packages
import React from 'react';
import noop from 'lodash/noop';
import Select from '@plitzi/plitzi-ui-components/Select';

/**
 * @param {{
 *   subType?:
 *     | 'div'
 *     | 'header'
 *     | 'footer'
 *     | 'nav'
 *     | 'main'
 *     | 'section'
 *     | 'article'
 *     | 'aside'
 *     | 'address'
 *     | 'figure'
 *     | 'dl'
 *     | 'dt'
 *     | 'dd';
 *   onUpdate?: (key: string, value: any) => void;
 * }} props
 * @returns {React.ReactElement}
 */
const Settings = props => {
  const { subType = 'div', onUpdate = noop } = props;
  const handleChange = key => e => onUpdate(key, e.target.value);

  return (
    <div className="flex flex-col">
      <div className="bg-blue-400 px-4 py-2 flex items-center justify-center">
        <h1 className="text-white m-0">Container Settings</h1>
      </div>
      <div className="flex flex-col p-2">
        <div className="flex flex-col">
          <label>Container Tag</label>
          <Select value={subType} onChange={handleChange('subType')} className="rounded-sm">
            <option value="div">Div</option>
            <option value="header">Header</option>
            <option value="footer">Footer</option>
            <option value="nav">Nav</option>
            <option value="main">Main</option>
            <option value="section">Section</option>
            <option value="article">Article</option>
            <option value="aside">Aside</option>
            <option value="address">Address</option>
            <option value="figure">Figure</option>
            <option value="dl">DL</option>
            <option value="dt">DT</option>
            <option value="dd">DD</option>
          </Select>
        </div>
      </div>
    </div>
  );
};

export default Settings;
