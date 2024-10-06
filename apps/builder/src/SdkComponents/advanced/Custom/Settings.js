// Packages
import React, { useCallback, useEffect } from 'react';
import noop from 'lodash/noop';
import Input from '@plitzi/plitzi-ui-components/Input';
import TextArea from '@plitzi/plitzi-ui-components/TextArea';
import Checkbox from '@plitzi/plitzi-ui-components/Checkbox';
import CodeMirror from '@plitzi/plitzi-ui-components/CodeMirror';

/**
 * @param {{
 *   renderType?: string;
 *   settings?: string;
 *   assets?: string;
 *   scriptUrl?: string;
 *   pluginScope?: string;
 *   isPlugin?: boolean;
 *   onUpdate?: (key: string, value: any) => void;
 * }} props
 * @returns {React.ReactElement}
 */
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

  const handleChange = useCallback(key => e => onUpdate(key, e.target.value), [onUpdate]);

  const handleChangeSettings = useCallback(value => onUpdate('settings', value), [onUpdate]);

  const handleChangeIsPlugin = useCallback(e => onUpdate('isPlugin', e.target.checked), [onUpdate]);

  useEffect(() => {
    if (!onUpdate || !settings) {
      return;
    }

    try {
      // Format settings
      onUpdate('settings', JSON.stringify(JSON.parse(settings), null, 2));
    } catch (e) {
      // Nothing to do
    }
  }, [onUpdate]);

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
          <CodeMirror
            className="min-h-[250px] rounded"
            value={settings}
            theme="dark"
            mode="json"
            lineWrapping
            onChange={handleChangeSettings}
          />
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

export default Settings;
