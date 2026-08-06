import Alert from '@plitzi/plitzi-ui/Alert';
import Button from '@plitzi/plitzi-ui/Button';
import Input from '@plitzi/plitzi-ui/Input';
import Select from '@plitzi/plitzi-ui/Select';
import { useCallback, useState } from 'react';

import { parseManifest } from '../../helpers/parseManifest';
import { validateManifest } from '../../helpers/validateManifest';
import { connectorPresets, emptyManifest } from '../../presets';
import ConnectorAdvancedEditor from '../ConnectorAdvancedEditor';
import ConnectorBasicEditor from '../ConnectorBasicEditor';

import type { ConnectorManifestDraft, SpaceConnector } from '@plitzi/sdk-shared';

export type ConnectorFormProps = {
  connector?: SpaceConnector;
  onSubmit: (name: string, manifest: ConnectorManifestDraft) => Promise<void> | void;
  onCancel: () => void;
};

const ConnectorForm = ({ connector, onSubmit, onCancel }: ConnectorFormProps) => {
  const [name, setName] = useState(connector?.name ?? '');
  const [manifest, setManifest] = useState<ConnectorManifestDraft>(() => connector?.manifest ?? emptyManifest);
  const [isAdvanced, setIsAdvanced] = useState(false);
  const [draft, setDraft] = useState('');
  const [errors, setErrors] = useState<string[]>([]);
  const [isSaving, setIsSaving] = useState(false);

  const handleChangePreset = useCallback((value: string) => {
    const preset = connectorPresets.find(item => item.id === value);
    if (preset) {
      setManifest(preset.manifest);
      setDraft(JSON.stringify(preset.manifest, null, 2));
    }
  }, []);

  const handleToggleAdvanced = useCallback(() => {
    setErrors([]);
    setIsAdvanced(current => {
      if (!current) {
        setDraft(JSON.stringify(manifest, null, 2));

        return true;
      }

      // Leaving advanced mode keeps whatever parsed last: a half-typed document would silently reset the form, and
      // the basic editor reads fields the malformed one may not have.
      const result = parseManifest(draft);
      if (result.manifest) {
        setManifest(result.manifest);
      } else {
        setErrors([result.error, 'The basic editor still shows the last valid version.']);
      }

      return false;
    });
  }, [manifest, draft]);

  const handleSubmit = useCallback(async () => {
    if (!name.trim()) {
      setErrors(['A name is required.']);

      return;
    }

    let parsed = manifest;
    if (isAdvanced) {
      const result = parseManifest(draft);
      if (!result.manifest) {
        setErrors([result.error]);

        return;
      }

      parsed = result.manifest;
    }

    const validation = validateManifest(parsed);
    if (validation.length) {
      setErrors(validation);

      return;
    }

    setErrors([]);
    setIsSaving(true);
    try {
      await onSubmit(name.trim(), parsed);
    } catch (err) {
      setErrors([(err as Error).message]);
    } finally {
      setIsSaving(false);
    }
  }, [name, manifest, isAdvanced, draft, onSubmit]);

  return (
    <div className="flex grow basis-0 flex-col gap-3 overflow-auto p-4">
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
      <div className="flex items-center justify-between">
        <span className="text-xs text-gray-500 dark:text-zinc-400">
          {isAdvanced ? 'Editing the stored manifest' : 'Guided setup'}
        </span>
        <Button size="xs" intent="secondary" onClick={handleToggleAdvanced}>
          {isAdvanced ? 'Basic' : 'Advanced (JSON)'}
        </Button>
      </div>
      {isAdvanced && <ConnectorAdvancedEditor value={draft} onChange={setDraft} />}
      {!isAdvanced && <ConnectorBasicEditor manifest={manifest} onChange={setManifest} />}
      {errors.length > 0 && (
        <Alert intent="error" size="sm" solid={false}>
          <div className="flex flex-col gap-1">
            {errors.map(error => (
              <span key={error} className="text-xs">
                {error}
              </span>
            ))}
          </div>
        </Alert>
      )}
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
