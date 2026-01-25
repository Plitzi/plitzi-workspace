import Checkbox from '@plitzi/plitzi-ui/Checkbox';
import Input from '@plitzi/plitzi-ui/Input';
import Select from '@plitzi/plitzi-ui/Select';
import TextArea from '@plitzi/plitzi-ui/TextArea';
import { useCallback, useMemo } from 'react';

import type { ChangeEvent } from 'react';

type SettingsProps = {
  subType?:
    | 'text'
    | 'number'
    | 'time'
    | 'email'
    | 'password'
    | 'select'
    | 'checkbox'
    | 'textarea'
    | 'hidden'
    | 'color'
    | 'switch';
  name?: string;
  label?: string;
  placeholder?: string;
  autoComplete?: boolean;
  defaultValue?: string;
  options?: string[];
  required?: boolean;
  readOnly?: boolean;
  disabled?: boolean;
  onUpdate?: (key: string, value: string | boolean | number | string[]) => void;
};

const Settings = ({
  subType = 'text',
  name = '',
  label = 'Label',
  defaultValue = '',
  placeholder = '',
  autoComplete = true,
  options,
  required = true,
  readOnly = false,
  disabled = false,
  onUpdate
}: SettingsProps) => {
  const handleChangeName = useCallback((value: string) => onUpdate?.('name', value), [onUpdate]);

  const handleChangeLabel = useCallback((value: string) => onUpdate?.('label', value), [onUpdate]);

  const handleChangePlaceholder = useCallback((value: string) => onUpdate?.('placeholder', value), [onUpdate]);

  const handleChangeType = useCallback(
    (value: string) => {
      onUpdate?.('subType', value);
      onUpdate?.('defaultValue', '');
    },
    [onUpdate]
  );

  const handleChangeDefaultValue = useCallback((value: string) => onUpdate?.('defaultValue', value), [onUpdate]);

  const handleChangeAutoComplete = useCallback(
    (e: ChangeEvent) => onUpdate?.('autoComplete', (e.target as HTMLInputElement).checked),
    [onUpdate]
  );

  const handleChangeRequired = useCallback(
    (e: ChangeEvent) => onUpdate?.('required', (e.target as HTMLInputElement).checked),
    [onUpdate]
  );

  const handleChangeReadOnly = useCallback(
    (e: ChangeEvent) => onUpdate?.('readOnly', (e.target as HTMLInputElement).checked),
    [onUpdate]
  );

  const handleChangeDisabled = useCallback(
    (e: ChangeEvent) => onUpdate?.('disabled', (e.target as HTMLInputElement).checked),
    [onUpdate]
  );

  const handleChangeOptions = useCallback(
    (value: string) => {
      if (!value) {
        onUpdate?.('options', []);

        return;
      }

      onUpdate?.('options', value.split('\n'));
    },
    [onUpdate]
  );

  // const handleChangeValue = useCallback(e => {}, [value, subType]);

  const optionsString = useMemo(() => (Array.isArray(options) ? options.join('\n') : ''), [options]);

  return (
    <div className="flex h-full flex-col gap-4 py-2">
      <Input value={name} label="Input Name" onChange={handleChangeName} size="xs" />
      <Input value={label} label="Label" onChange={handleChangeLabel} size="xs" />
      <Input value={placeholder} label="Placeholder" onChange={handleChangePlaceholder} size="xs" />
      <Select value={subType} onChange={handleChangeType} label="Input Type" size="xs">
        <option value="text">Text</option>
        <option value="number">Number</option>
        <option value="time">Time</option>
        <option value="email">Email</option>
        <option value="password">Password</option>
        <option value="select">Select</option>
        <option value="checkbox">Checkbox</option>
        <option value="textarea">Long Text</option>
        <option value="hidden">Hidden</option>
        {/* <option value="color">Color</option> */}
        {/* <option value="switch">Switch</option> */}
      </Select>
      <TextArea value={defaultValue} label="Default Value" onChange={handleChangeDefaultValue} size="xs" />
      {/* <div className="flex flex-col mt-4">
          <label>Value</label>
          <Input value={value} onChange={handleChangeValue} />
        </div> */}
      {subType === 'text' && (
        <Checkbox checked={autoComplete} label="Auto Complete" onChange={handleChangeAutoComplete} size="xs" />
      )}
      {(subType === 'text' ||
        subType === 'textarea' ||
        subType === 'number' ||
        subType === 'email' ||
        subType === 'password') && (
        <Checkbox checked={readOnly} label="Read Only" onChange={handleChangeReadOnly} size="xs" />
      )}
      {subType === 'select' && (
        <TextArea value={optionsString} label="Options" onChange={handleChangeOptions} size="xs" />
      )}
      <Checkbox checked={required} label="Required" onChange={handleChangeRequired} size="xs" />
      <Checkbox checked={disabled} label="Disabled" onChange={handleChangeDisabled} size="xs" />
    </div>
  );
};

export default Settings;
