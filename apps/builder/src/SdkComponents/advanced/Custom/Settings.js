// Packages
import React from 'react';
import PropTypes from 'prop-types';
import noop from 'lodash/noop';
import Input from '@plitzi/plitzi-ui-components/Input';
import TextArea from '@plitzi/plitzi-ui-components/TextArea';
import Checkbox from '@plitzi/plitzi-ui-components/Checkbox';

const Settings = props => {
  const {
    renderType = '',
    settings = '{}',
    isPlugin = false,
    assets = '',
    scriptUrl = '',
    pluginScope = '',
    onUpdate = noop
  } = props;

  const handleChange = key => e => onUpdate(key, e.target.value);

  const handleChangeIsPlugin = e => onUpdate('isPlugin', e.target.checked);

  return (
    <div className="flex flex-col">
      <div className="bg-blue-400 px-4 py-2 flex items-center justify-center">
        <h1 className="text-white m-0">Custom Settings</h1>
      </div>
      <div className="flex flex-col p-2">
        <div className="flex flex-col">
          <label>Render Type</label>
          <Input value={renderType} onChange={handleChange('renderType')} inputClassName="rounded" />
        </div>
        <div className="flex flex-col mt-4">
          <label>Settings</label>
          <TextArea value={settings} onChange={handleChange('settings')} className="rounded" />
        </div>
        <div className="flex items-center mt-4">
          <Checkbox id="custom-is-plugin" checked={isPlugin} onChange={handleChangeIsPlugin} className="rounded mr-2" />
          <label htmlFor="custom-is-plugin" className="cursor-pointer select-none">
            Is Plugin
          </label>
        </div>
        {isPlugin && (
          <>
            <div className="flex flex-col mt-4">
              <label>Plugin Scope</label>
              <Input value={pluginScope} onChange={handleChange('pluginScope')} inputClassName="rounded" />
            </div>
            <div className="flex flex-col mt-4">
              <label>Plugin Script Url</label>
              <Input value={scriptUrl} onChange={handleChange('scriptUrl')} inputClassName="rounded" />
            </div>
            <div className="flex flex-col mt-4">
              <label>Plugin Assets (Styles)</label>
              <TextArea value={assets} onChange={handleChange('assets')} className="rounded" />
            </div>
          </>
        )}
      </div>
    </div>
  );
};

Settings.propTypes = {
  renderType: PropTypes.string,
  settings: PropTypes.string,
  assets: PropTypes.string,
  scriptUrl: PropTypes.string,
  pluginScope: PropTypes.string,
  isPlugin: PropTypes.bool,
  onUpdate: PropTypes.func
};

export default Settings;
