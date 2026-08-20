import Button from '@plitzi/plitzi-ui/Button';
import Input from '@plitzi/plitzi-ui/Input';
import Select from '@plitzi/plitzi-ui/Select';
import { useCallback } from 'react';

import type { ActionField, ActionFieldType } from '@plitzi/sdk-shared';

export type ActionFieldsProps = {
  label: string;
  hint: string;
  fields: Record<string, ActionField>;
  onChange: (fields: Record<string, ActionField>) => void;
};

const TYPES: ActionFieldType[] = ['text', 'number', 'boolean', 'date', 'json', 'file'];

/**
 * The input and output contracts, edited as a list of typed names.
 *
 * These are not decoration: inputs are coerced and anything undeclared is dropped before a single step runs, and
 * outputs are the ONLY keys a caller gets back. Which is why both are edited in the same place and with the same
 * shape — an author who understands one understands the other.
 */
const ActionFields = ({ label, hint, fields, onChange }: ActionFieldsProps) => {
  const entries = Object.entries(fields);

  const handleRename = useCallback(
    (key: string) => (value: string) => {
      if (!value || value === key) {
        return;
      }

      // Rebuilt in order rather than deleted and re-added, so renaming a field does not send it to the bottom of
      // the list while someone is typing.
      onChange(Object.fromEntries(entries.map(([name, field]) => (name === key ? [value, field] : [name, field]))));
    },
    [entries, onChange]
  );

  const handleChangeType = useCallback(
    (key: string) => (value: string) =>
      onChange({ ...fields, [key]: { ...fields[key], type: value as ActionFieldType } }),
    [fields, onChange]
  );

  const handleToggleRequired = useCallback(
    (key: string) => () => onChange({ ...fields, [key]: { ...fields[key], required: !fields[key].required } }),
    [fields, onChange]
  );

  const handleRemove = useCallback(
    (key: string) => () => onChange(Object.fromEntries(entries.filter(([name]) => name !== key))),
    [entries, onChange]
  );

  const handleAdd = useCallback(() => {
    const base = 'field';
    let name = base;
    let index = 1;
    while (Object.hasOwn(fields, name)) {
      name = `${base}${index}`;
      index += 1;
    }

    onChange({ ...fields, [name]: { type: 'text' } });
  }, [fields, onChange]);

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium">{label}</span>
        <Button size="xs" onClick={handleAdd}>
          Add
        </Button>
      </div>
      <span className="text-xs text-gray-500">{hint}</span>
      {entries.map(([key, field]) => (
        <div key={key} className="flex items-center gap-2">
          <Input value={key} size="xs" placeholder="name" onChange={handleRename(key)} />
          <Select value={field.type} size="xs" onChange={handleChangeType(key)}>
            {TYPES.map(type => (
              <option key={type} value={type}>
                {type}
              </option>
            ))}
          </Select>
          <Button size="xs" intent={field.required ? 'primary' : 'secondary'} onClick={handleToggleRequired(key)}>
            required
          </Button>
          <Button size="xs" onClick={handleRemove(key)} title="Remove field">
            <Button.Icon icon="fa-solid fa-trash" />
          </Button>
        </div>
      ))}
    </div>
  );
};

export default ActionFields;
