import Alert from '@plitzi/plitzi-ui/Alert';
import Checkbox from '@plitzi/plitzi-ui/Checkbox';
import CodeMirror from '@plitzi/plitzi-ui/CodeMirror';
import Input from '@plitzi/plitzi-ui/Input';
import TextArea from '@plitzi/plitzi-ui/TextArea';
import { useCallback, useEffect, useEffectEvent, useState } from 'react';

import useTheme from '@plitzi/sdk-shared/theme/useTheme';

import useSettingsUpdate from '../../useSettingsUpdate';

import type { ChangeEvent } from 'react';

type SettingsProps = {
  renderType?: string;
  settings?: string;
  assets?: string;
  scriptUrl?: string;
  isPlugin?: boolean;
  onUpdate?: (key: string, value: string | boolean | number) => void;
};

const Settings = ({
  renderType = '',
  settings = '{}',
  isPlugin = false,
  assets = '',
  scriptUrl = '',
  onUpdate
}: SettingsProps) => {
  const { resolvedTheme } = useTheme();
  const [jsonValid, setJsonValid] = useState(true);

  const update = useSettingsUpdate(onUpdate);

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
    (e: ChangeEvent<HTMLInputElement>) => onUpdate?.('isPlugin', e.target.checked),
    [onUpdate]
  );

  // Read as the panel opens for the element: an empty `settings` starts as `{}`, and valid JSON is laid out to read.
  const normaliseSettings = useEffectEvent(() => {
    if (!onUpdate || !settings) {
      onUpdate?.('settings', '{}');
      setJsonValid(true);

      return;
    }

    try {
      const newSettings = JSON.stringify(JSON.parse(settings), null, 2);
      if (newSettings !== settings) {
        onUpdate('settings', newSettings);
      }

      setJsonValid(true);
    } catch {
      setJsonValid(false);
    }
  });

  useEffect(() => normaliseSettings(), [onUpdate]);

  return (
    <div className="flex flex-col gap-4 py-2">
      <Input value={renderType} label="Render Type" onChange={update.text('renderType')} size="xs" />
      <div className="flex flex-col">
        <label>Settings</label>
        <CodeMirror
          className="min-h-62.5"
          value={settings}
          theme={resolvedTheme}
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
          <Input value={scriptUrl} label="Plugin Script Url" onChange={update.text('scriptUrl')} size="xs" />
          <TextArea value={assets} label="Plugin Assets (Styles)" onChange={update.text('assets')} size="xs" />
        </>
      )}
    </div>
  );
};

export default Settings;
