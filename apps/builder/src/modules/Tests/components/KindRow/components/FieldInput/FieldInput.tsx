import Input from '@plitzi/plitzi-ui/Input';
import Select from '@plitzi/plitzi-ui/Select';
import { use, useCallback } from 'react';

import { valueOf, valueText } from '../../../../helpers';
import TestStudioContext from '../../../../studio/TestStudioContext';

import type { FieldSpec } from '../../../../helpers';

export type FieldInputProps = {
  field: FieldSpec;
  value: unknown;
  /** The elements an element field may name. */
  elements: { value: string; label: string }[];
  onChange: (name: string, value: unknown) => void;
};

/**
 * One field of a row, as its kind says: an element picked from the space, one of its element checks by its title, a
 * number, words, or any value.
 */
const FieldInput = ({ field, value, elements, onChange }: FieldInputProps) => {
  const { tests } = use(TestStudioContext);
  const handleChange = useCallback(
    (text: string) => {
      onChange(field.name, field.kind === 'number' ? Number(text) : field.kind === 'value' ? valueOf(text) : text);
    },
    [field, onChange]
  );

  if (field.kind === 'element') {
    return (
      <Select size="sm" name={field.name} label={field.label} value={valueText(value)} onChange={handleChange}>
        {elements.map(option => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </Select>
    );
  }

  if (field.kind === 'check') {
    return (
      <Select size="sm" name={field.name} label={field.label} value={valueText(value)} onChange={handleChange}>
        <option value="">
          {tests.unit?.length ? 'Choose an element check' : 'The space has no element checks yet'}
        </option>
        {(tests.unit ?? []).map(check => (
          <option key={check.id} value={check.id}>
            {check.title || check.id}
          </option>
        ))}
      </Select>
    );
  }

  return (
    <Input
      size="sm"
      name={field.name}
      label={field.label}
      type={field.kind === 'number' ? 'number' : 'text'}
      value={valueText(value)}
      onChange={handleChange}
    />
  );
};

export default FieldInput;
