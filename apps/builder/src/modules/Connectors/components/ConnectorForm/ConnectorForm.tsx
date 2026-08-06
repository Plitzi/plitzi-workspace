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
    <div className="flex grow basis-0 flex-col">
      <div className="mx-auto flex w-full max-w-4xl flex-col gap-2 p-3 pb-2">
        <div className="flex items-end gap-2">
          <Input className="grow" value={name} label="Name" placeholder="Blog CMS" onChange={setName} size="xs" />
          <Button
            size="xs"
            intent="secondary"
            title={isAdvanced ? 'Back to the guided form' : 'Edit the stored manifest as JSON'}
            onClick={handleToggleAdvanced}
          >
            <Button.Icon icon={isAdvanced ? 'fa-solid fa-list-check' : 'fa-solid fa-code'} />
          </Button>
        </div>
        {!connector && !isAdvanced && (
          <Select value="" label="Start from" onChange={handleChangePreset} size="xs">
            <option value="">Choose your API or CMS…</option>
            {connectorPresets.map(preset => (
              <option key={preset.id} value={preset.id}>
                {preset.label}
              </option>
            ))}
          </Select>
        )}
      </div>
      <div className="mx-auto flex w-full max-w-4xl grow basis-0 flex-col overflow-auto px-3">
        {isAdvanced && <ConnectorAdvancedEditor value={draft} onChange={setDraft} />}
        {!isAdvanced && <ConnectorBasicEditor manifest={manifest} onChange={setManifest} />}
      </div>
      <div className="mx-auto flex w-full max-w-4xl flex-col gap-2 border-t border-gray-200 p-3 dark:border-zinc-700">
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
    </div>
  );
};

export default ConnectorForm;
