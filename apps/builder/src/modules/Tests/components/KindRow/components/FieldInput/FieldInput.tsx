import Input from '@plitzi/plitzi-ui/Input';
import Select from '@plitzi/plitzi-ui/Select';
import { useCallback } from 'react';

import { valueOf, valueText } from '../../../../helpers';

import type { FieldSpec } from '../../../../helpers';

export type FieldInputProps = {
  field: FieldSpec;
  value: unknown;
  /** The elements an element field may name. */
  elements: { value: string; label: string }[];
  onChange: (name: string, value: unknown) => void;
};

/** One field of a row, as its kind says: an element picked from the space, a number, words, or any value. */
const FieldInput = ({ field, value, elements, onChange }: FieldInputProps) => {
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
