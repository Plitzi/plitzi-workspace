import Button from '@plitzi/plitzi-ui/Button';
import CodeMirror from '@plitzi/plitzi-ui/CodeMirror';
import Input from '@plitzi/plitzi-ui/Input';
import Select from '@plitzi/plitzi-ui/Select';
import { useCallback, use, useState } from 'react';

import { ThemeContext } from '@plitzi/sdk-shared/theme/ThemeProvider';

import { connectorPresets } from '../../presets';

import type { SpaceConnector } from '@plitzi/sdk-shared';

export type ConnectorFormProps = {
  connector?: SpaceConnector;
  onSubmit: (name: string, manifest: Record<string, unknown>) => Promise<void> | void;
  onCancel: () => void;
};

const ConnectorForm = ({ connector, onSubmit, onCancel }: ConnectorFormProps) => {
  const { theme } = use(ThemeContext);
  const [name, setName] = useState(connector?.name ?? '');
  const [manifest, setManifest] = useState(() => JSON.stringify(connector?.manifest ?? {}, null, 2));
  const [error, setError] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const handleChangePreset = useCallback((value: string) => {
    const preset = connectorPresets.find(item => item.id === value);
    if (preset) {
      setManifest(JSON.stringify(preset.manifest, null, 2));
    }
  }, []);

  const handleSubmit = useCallback(async () => {
    if (!name.trim()) {
      setError('A name is required');

      return;
    }

    let parsed: Record<string, unknown>;
    try {
      parsed = JSON.parse(manifest) as Record<string, unknown>;
    } catch (err) {
      setError(`The manifest is not valid JSON: ${(err as Error).message}`);

      return;
    }

    setError('');
    setIsSaving(true);
    try {
      await onSubmit(name.trim(), parsed);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setIsSaving(false);
    }
  }, [name, manifest, onSubmit]);

  return (
    <div className="flex grow basis-0 flex-col gap-3 p-4">
      <Input value={name} label="Name" placeholder="Blog CMS" onChange={setName} size="xs" />
      {!connector && (
        <Select value="" label="Start from" onChange={handleChangePreset} size="xs">
          <option value="">Choose a preset…</option>
          {connectorPresets.map(preset => (
            <option key={preset.id} value={preset.id}>
              {preset.label}
            </option>
          ))}
        </Select>
      )}
      <div className="flex min-h-80 grow flex-col">
        <label>Manifest</label>
        <CodeMirror
          value={manifest}
          theme={theme === 'dark' ? 'dark' : 'light'}
          mode="json"
          lineWrapping
          onChange={setManifest}
        />
      </div>
      {error && <span className="text-xs text-red-600">{error}</span>}
      <span className="text-xs text-gray-500">
        Reference a credential by its identifier — <code>{'{{credential.token}}'}</code> resolves on the server. The
        secret itself never leaves it, and neither does this manifest.
      </span>
      <div className="flex justify-end gap-2">
        <Button size="sm" intent="secondary" onClick={onCancel}>
          Cancel
        </Button>
        <Button size="sm" onClick={handleSubmit} disabled={isSaving}>
          {connector ? 'Save' : 'Create'}
        </Button>
      </div>
    </div>
  );
};

export default ConnectorForm;
