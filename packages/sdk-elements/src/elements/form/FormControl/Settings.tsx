import Checkbox from '@plitzi/plitzi-ui/Checkbox';
import Input from '@plitzi/plitzi-ui/Input';
import Select from '@plitzi/plitzi-ui/Select';
import TextArea from '@plitzi/plitzi-ui/TextArea';
import { useCallback, useMemo } from 'react';

import { hasFormat } from './helpers/validateField';

import type { ChangeEvent } from 'react';

type SettingsProps = {
  subType?:
    | 'text'
    | 'number'
    | 'date'
    | 'time'
    | 'email'
    | 'password'
    | 'search'
    | 'url'
    | 'tel'
    | 'select'
    | 'checkbox'
    | 'textarea'
    | 'hidden'
    | 'color'
    | 'switch';
  name?: string;
  label?: string;
  hideLabel?: boolean;
  placeholder?: string;
  autoComplete?: boolean;
  autoFocus?: boolean;
  defaultValue?: string;
  options?: string[];
  required?: boolean;
  requiredMessage?: string;
  minLength?: number;
  minLengthMessage?: string;
  maxLength?: number;
  maxLengthMessage?: string;
  formatMessage?: string;
  pattern?: string;
  patternMessage?: string;
  matches?: string;
  matchesMessage?: string;
  readOnly?: boolean;
  disabled?: boolean;
  previewError?: boolean;
  onUpdate?: (key: string, value: string | boolean | number | string[]) => void;
};

/** A length typed into a text box: anything that is not a whole, positive number means "no rule". */
const toLength = (value: string): number => {
  const parsed = parseInt(value, 10);

  return Number.isNaN(parsed) || parsed < 0 ? 0 : parsed;
};

const Settings = ({
  subType = 'text',
  name = '',
  label = 'Label',
  hideLabel = false,
  defaultValue = '',
  placeholder = '',
  autoComplete = true,
  autoFocus = false,
  options,
  required = true,
  requiredMessage = '',
  minLength = 0,
  minLengthMessage = '',
  maxLength = 0,
  maxLengthMessage = '',
  formatMessage = '',
  pattern = '',
  patternMessage = '',
  matches = '',
  matchesMessage = '',
  readOnly = false,
  disabled = false,
  previewError = false,
  onUpdate
}: SettingsProps) => {
  // The subtypes that hold typed text, which are the ones a length, a pattern or a confirmation can mean anything for.
  const isTyped = ['text', 'textarea', 'number', 'email', 'password', 'search', 'url', 'tel'].includes(subType);

  const handleChangeName = useCallback((value: string) => onUpdate?.('name', value), [onUpdate]);

  const handleChangeLabel = useCallback((value: string) => onUpdate?.('label', value), [onUpdate]);

  const handleChangeHideLabel = useCallback(
    (e: ChangeEvent<HTMLInputElement>) => onUpdate?.('hideLabel', e.target.checked),
    [onUpdate]
  );

  const handleChangePlaceholder = useCallback((value: string) => onUpdate?.('placeholder', value), [onUpdate]);

  const handleChangeType = useCallback(
    (value: string) => {
      onUpdate?.('subType', value);
      onUpdate?.('defaultValue', '');
    },
    [onUpdate]
  );

  const handleChangeDefaultValue = useCallback((value: string) => onUpdate?.('defaultValue', value), [onUpdate]);

  const handleChangeAutoFocus = useCallback(
    (e: ChangeEvent<HTMLInputElement>) => onUpdate?.('autoFocus', e.target.checked),
    [onUpdate]
  );

  const handleChangeAutoComplete = useCallback(
    (e: ChangeEvent<HTMLInputElement>) => onUpdate?.('autoComplete', e.target.checked),
    [onUpdate]
  );

  const handleChangeRequired = useCallback(
    (e: ChangeEvent<HTMLInputElement>) => onUpdate?.('required', e.target.checked),
    [onUpdate]
  );

  const handleChangeRequiredMessage = useCallback((value: string) => onUpdate?.('requiredMessage', value), [onUpdate]);

  const handleChangeMinLength = useCallback((value: string) => onUpdate?.('minLength', toLength(value)), [onUpdate]);

  const handleChangeMinLengthMessage = useCallback(
    (value: string) => onUpdate?.('minLengthMessage', value),
    [onUpdate]
  );

  const handleChangeMaxLength = useCallback((value: string) => onUpdate?.('maxLength', toLength(value)), [onUpdate]);

  const handleChangeMaxLengthMessage = useCallback(
    (value: string) => onUpdate?.('maxLengthMessage', value),
    [onUpdate]
  );

  const handleChangeFormatMessage = useCallback((value: string) => onUpdate?.('formatMessage', value), [onUpdate]);

  const handleChangePattern = useCallback((value: string) => onUpdate?.('pattern', value), [onUpdate]);

  const handleChangePatternMessage = useCallback((value: string) => onUpdate?.('patternMessage', value), [onUpdate]);

  const handleChangeMatches = useCallback((value: string) => onUpdate?.('matches', value), [onUpdate]);

  const handleChangeMatchesMessage = useCallback((value: string) => onUpdate?.('matchesMessage', value), [onUpdate]);

  const handleChangeReadOnly = useCallback(
    (e: ChangeEvent<HTMLInputElement>) => onUpdate?.('readOnly', e.target.checked),
    [onUpdate]
  );

  const handleChangeDisabled = useCallback(
    (e: ChangeEvent<HTMLInputElement>) => onUpdate?.('disabled', e.target.checked),
    [onUpdate]
  );

  const handleChangePreviewError = useCallback(
    (e: ChangeEvent<HTMLInputElement>) => onUpdate?.('previewError', e.target.checked),
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

  const optionsString = useMemo(() => (Array.isArray(options) ? options.join('\n') : ''), [options]);

  return (
    <div className="flex h-full flex-col gap-4 py-2">
      <Input value={name} label="Input Name" onChange={handleChangeName} size="xs" />
      <Input value={label} label="Label" onChange={handleChangeLabel} size="xs" />
      <Checkbox
        checked={hideLabel}
        label="Hide Label (still read by screen readers)"
        onChange={handleChangeHideLabel}
        size="xs"
      />
      <Input value={placeholder} label="Placeholder" onChange={handleChangePlaceholder} size="xs" />
      <Select value={subType} onChange={handleChangeType} label="Input Type" size="xs">
        <option value="text">Text</option>
        <option value="number">Number</option>
        <option value="date">Date</option>
        <option value="time">Time</option>
        <option value="email">Email</option>
        <option value="search">Search</option>
        <option value="url">URL</option>
        <option value="tel">Phone</option>
        <option value="password">Password</option>
        <option value="select">Select</option>
        <option value="checkbox">Checkbox</option>
        <option value="textarea">Long Text</option>
        <option value="hidden">Hidden</option>
        <option value="color">Color</option>
      </Select>
      <TextArea value={defaultValue} label="Default Value" onChange={handleChangeDefaultValue} size="xs" />
      {subType === 'text' && (
        <Checkbox checked={autoComplete} label="Auto Complete" onChange={handleChangeAutoComplete} size="xs" />
      )}
      {isTyped && <Checkbox checked={readOnly} label="Read Only" onChange={handleChangeReadOnly} size="xs" />}
      <Checkbox checked={autoFocus} label="Focus When Shown" onChange={handleChangeAutoFocus} size="xs" />
      {subType === 'select' && (
        <TextArea value={optionsString} label="Options" onChange={handleChangeOptions} size="xs" />
      )}
      <Checkbox checked={required} label="Required" onChange={handleChangeRequired} size="xs" />
      {required && (
        <Input value={requiredMessage} label="Required Message" onChange={handleChangeRequiredMessage} size="xs" />
      )}
      {isTyped && (
        <Input
          value={minLength ? String(minLength) : ''}
          label="Min Length"
          onChange={handleChangeMinLength}
          size="xs"
        />
      )}
      {isTyped && minLength > 0 && (
        <Input value={minLengthMessage} label="Min Length Message" onChange={handleChangeMinLengthMessage} size="xs" />
      )}
      {isTyped && (
        <Input
          value={maxLength ? String(maxLength) : ''}
          label="Max Length"
          onChange={handleChangeMaxLength}
          size="xs"
        />
      )}
      {isTyped && maxLength > 0 && (
        <Input value={maxLengthMessage} label="Max Length Message" onChange={handleChangeMaxLengthMessage} size="xs" />
      )}
      {hasFormat(subType) && (
        <Input value={formatMessage} label="Invalid Format Message" onChange={handleChangeFormatMessage} size="xs" />
      )}
      {isTyped && (
        <Input value={pattern} label="Pattern (regular expression)" onChange={handleChangePattern} size="xs" />
      )}
      {isTyped && pattern && (
        <Input value={patternMessage} label="Pattern Message" onChange={handleChangePatternMessage} size="xs" />
      )}
      {isTyped && <Input value={matches} label="Must Match Field" onChange={handleChangeMatches} size="xs" />}
      {isTyped && matches && (
        <Input value={matchesMessage} label="Mismatch Message" onChange={handleChangeMatchesMessage} size="xs" />
      )}
      <Checkbox checked={disabled} label="Disabled" onChange={handleChangeDisabled} size="xs" />
      <Checkbox checked={previewError} label="Preview Error Message" onChange={handleChangePreviewError} size="xs" />
    </div>
  );
};

export default Settings;
