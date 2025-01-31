// Packages
import React, { useCallback, useEffect, useState } from 'react';
import noop from 'lodash/noop';
import Input from '@plitzi/plitzi-ui-components/Input';
import TextArea from '@plitzi/plitzi-ui-components/TextArea';
import Checkbox from '@plitzi/plitzi-ui-components/Checkbox';
import CodeMirror from '@plitzi/plitzi-ui/CodeMirror';
import Alert from '@plitzi/plitzi-ui-components/Alert';

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
  const [jsonValid, setJsonValid] = useState(true);

  const handleChange = useCallback(key => e => onUpdate(key, e.target.value), [onUpdate]);

  const handleChangeSettings = useCallback(
    value => {
      if (!value) {
        value = '{}';
      }

      try {
        onUpdate('settings', value);
        // Format settings
        JSON.stringify(JSON.parse(value));
        setJsonValid(true);
      } catch (e) {
        // Nothing to do
        setJsonValid(false);
      }
    },
    [onUpdate]
  );

  const handleChangeIsPlugin = useCallback(e => onUpdate('isPlugin', e.target.checked), [onUpdate]);

  useEffect(() => {
    if (!onUpdate || !settings) {
      onUpdate('settings', '{}');
      setJsonValid(true);

      return;
    }

    try {
      // Format settings
      const newSettings = JSON.stringify(JSON.parse(settings), null, 2);
      if (newSettings !== settings) {
        onUpdate('settings', newSettings);
      }

      setJsonValid(true);
    } catch (e) {
      // Nothing to do
      setJsonValid(false);
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
          <Input value={renderType} onChange={handleChange('renderType')} inputClassName="rounded-sm" />
        </div>
        <div className="flex flex-col mt-4">
          <label>Settings</label>
          <CodeMirror
            className="min-h-[250px] rounded-sm"
            value={settings}
            theme="dark"
            mode="json"
            lineWrapping
            onChange={handleChangeSettings}
          />
        </div>
        {!jsonValid && (
          <Alert className="text-white mt-1" intent="warning">
            <div className="flex items-center h-full w-full">This json is invalid</div>
          </Alert>
        )}
        <div className="flex items-center mt-4">
          <Checkbox
            id="custom-is-plugin"
            checked={isPlugin}
            onChange={handleChangeIsPlugin}
            className="rounded-sm mr-2"
          />
          <label htmlFor="custom-is-plugin" className="cursor-pointer select-none">
            Is Plugin
          </label>
        </div>
        rounded-sm"
        {isPlugin && (
          <>
            <div className="flex flex-col mt-4">
              <label>Plugin Scope</label>
              <Input value={pluginScope} onChange={handleChange('pluginScope')} inputClassName="rounded-sm" />
            </div>
            <div className="flex flex-col mt-4">
              <label>Plugin Script Url</label>
              <Input value={scriptUrl} onChange={handleChange('scriptUrl')} inputClassName="rounded-sm" />
            </div>
            <div className="flex flex-col mt-4">
              <label>Plugin Assets (Styles)</label>
              <TextArea value={assets} onChange={handleChange('assets')} className="rounded-sm" />
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default Settings;
