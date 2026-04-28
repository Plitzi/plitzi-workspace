import Alert from '@plitzi/plitzi-ui/Alert';
import Checkbox from '@plitzi/plitzi-ui/Checkbox';
import CodeMirror from '@plitzi/plitzi-ui/CodeMirror';
import Input from '@plitzi/plitzi-ui/Input';
import TextArea from '@plitzi/plitzi-ui/TextArea';
import { use, useCallback, useEffect, useState } from 'react';

import { ThemeContext } from '@plitzi/sdk-shared/theme/ThemeProvider';

import type { ChangeEvent } from 'react';

type SettingsProps = {
  renderType?: string;
  settings?: string;
  assets?: string;
  scriptUrl?: string;
  pluginScope?: string;
  isPlugin?: boolean;
  onUpdate?: (key: string, value: string | boolean | number) => void;
};

const Settings = ({
  renderType = '',
  settings = '{}',
  isPlugin = false,
  assets = '',
  scriptUrl = '',
  pluginScope = '',
  onUpdate
}: SettingsProps) => {
  const { theme } = use(ThemeContext);
  const [jsonValid, setJsonValid] = useState(true);

  const handleChange = useCallback((key: string) => (value: string) => onUpdate?.(key, value), [onUpdate]);

  const handleChangeSettings = useCallback(
    (value: string) => {
      if (!value) {
        value = '{}';
      }

      try {
        onUpdate?.('settings', value);
        // Format settings
        JSON.stringify(JSON.parse(value));
        setJsonValid(true);
      } catch {
        // Nothing to do
        setJsonValid(false);
      }
    },
    [onUpdate]
  );

  const handleChangeIsPlugin = useCallback(
    (e: ChangeEvent) => onUpdate?.('isPlugin', (e.target as HTMLInputElement).checked),
    [onUpdate]
  );

  useEffect(() => {
    if (!onUpdate || !settings) {
      onUpdate?.('settings', '{}');
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
    } catch {
      // Nothing to do
      setJsonValid(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onUpdate]);

  return (
    <div className="flex flex-col gap-4 py-2">
      <Input value={renderType} label="Render Type" onChange={handleChange('renderType')} size="xs" />
      <div className="flex flex-col">
        <label>Settings</label>
        <CodeMirror
          className="min-h-62.5"
          value={settings}
          theme={theme === 'dark' ? 'dark' : 'light'}
          mode="json"
          size="xs"
          lineWrapping
          onChange={handleChangeSettings}
        />
      </div>
      {!jsonValid && (
        <Alert className="mt-1" solid={false} intent="warning" size="xs">
          <div className="flex h-full w-full items-center">This json is invalid</div>
        </Alert>
      )}
      <Checkbox checked={isPlugin} onChange={handleChangeIsPlugin} label="Is Plugin" size="xs" />
      {isPlugin && (
        <>
          <Input value={pluginScope} label="Plugin Scope" onChange={handleChange('pluginScope')} size="xs" />
          <Input value={scriptUrl} label="Plugin Script Url" onChange={handleChange('scriptUrl')} size="xs" />
          <TextArea value={assets} label="Plugin Assets (Styles)" onChange={handleChange('assets')} size="xs" />
        </>
      )}
    </div>
  );
};

export default Settings;
