import Input from '@plitzi/plitzi-ui/Input';
import Select from '@plitzi/plitzi-ui/Select';
import Switch from '@plitzi/plitzi-ui/Switch';
import TextArea from '@plitzi/plitzi-ui/TextArea';
import { useCallback, useId } from 'react';

import { fieldText } from '../../../../helpers';

import type { FunctionTaskManifest } from '@plitzi/sdk-shared';
import type { ChangeEvent } from 'react';

export type TryFieldProps = {
  name: string;
  param: FunctionTaskManifest['params'][string];
  value: unknown;
  onChange: (name: string, value: unknown) => void;
};

/** One param of a task, drawn as its step would draw it: a choice from its options, a switch, or text. */
const TryField = ({ name, param, value, onChange }: TryFieldProps) => {
  const label = param.label ?? name;
  const id = useId();

  const handleText = useCallback((next: string) => onChange(name, next), [name, onChange]);

  const handleSwitch = useCallback(
    (e: ChangeEvent<HTMLInputElement>) => onChange(name, e.target.checked),
    [name, onChange]
  );

  // A list of element ids, typed as ids are written: separated by commas.
  const handleIds = useCallback(
    (next: string) =>
      onChange(
        name,
        next
          .split(',')
          .map(id => id.trim())
          .filter(Boolean)
      ),
    [name, onChange]
  );

  return (
    <div className="flex flex-col gap-1">
      {param.type === 'select' && Array.isArray(param.options) && (
        <Select id={id} size="xs" label={label} value={fieldText(value)} onChange={handleText}>
          {param.options.map(option => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </Select>
      )}
      {param.type === 'boolean' && (
        <Switch id={id} size="xs" label={label} checked={value === true} onChange={handleSwitch} />
      )}
      {(param.type === 'text' || param.type === 'codemirror-text') && (
        <Input id={id} size="xs" label={label} value={fieldText(value)} onChange={handleText} />
      )}
      {(param.type === 'textarea' || param.type === 'codemirror-json') && (
        <TextArea
          className="w-full font-mono"
          id={id}
          size="xs"
          label={label}
          value={fieldText(value)}
          onChange={handleText}
        />
      )}
      {param.type === 'elements' && (
        <Input
          id={id}
          size="xs"
          label={label}
          placeholder="element ids, separated by commas"
          value={Array.isArray(value) ? value.join(', ') : ''}
          onChange={handleIds}
        />
      )}
    </div>
  );
};

export default TryField;
