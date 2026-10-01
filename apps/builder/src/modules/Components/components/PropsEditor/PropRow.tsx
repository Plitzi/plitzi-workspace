import Checkbox from '@plitzi/plitzi-ui/Checkbox';
import Flex from '@plitzi/plitzi-ui/Flex';
import Icon from '@plitzi/plitzi-ui/Icon';
import Input from '@plitzi/plitzi-ui/Input';
import Select2 from '@plitzi/plitzi-ui/Select2';
import { useCallback } from 'react';

import type { Option, OptionGroup } from '@plitzi/plitzi-ui/Select2';
import type { ComponentProp } from '@plitzi/sdk-shared';
import type { ChangeEvent } from 'react';

export type PropEntry = { name: string; prop: ComponentProp };

export type PropRowProps = {
  index: number;
  entry: PropEntry;
  problem?: string;
  onChange: (index: number, entry: PropEntry) => void;
  onRemove: (index: number) => void;
};

const TYPES: { value: ComponentProp['type']; label: string }[] = [
  { value: 'text', label: 'Text' },
  { value: 'textarea', label: 'Long text' },
  { value: 'number', label: 'Number' },
  { value: 'boolean', label: 'Yes / no' },
  { value: 'select', label: 'One of' },
  { value: 'json', label: 'Data' }
];

const isPropType = (value: string): value is ComponentProp['type'] => TYPES.some(type => type.value === value);

const PropRow = ({ index, entry, problem, onChange, onRemove }: PropRowProps) => {
  const { name, prop } = entry;

  const handleName = useCallback((value: string) => onChange(index, { name: value, prop }), [index, prop, onChange]);
  const handleDescription = useCallback(
    (description: string) => onChange(index, { name, prop: { ...prop, description } }),
    [index, name, prop, onChange]
  );
  const handleType = useCallback(
    (option?: Exclude<Option, OptionGroup>) => {
      const type = option?.value ?? 'text';
      if (isPropType(type)) {
        onChange(index, { name, prop: { ...prop, type } });
      }
    },
    [index, name, prop, onChange]
  );
  const handleOptions = useCallback(
    (value: string) =>
      onChange(index, {
        name,
        prop: {
          ...prop,
          options: value
            .split(',')
            .map(option => option.trim())
            .filter(Boolean)
        }
      }),
    [index, name, prop, onChange]
  );
  const handleRequired = useCallback(
    (event: ChangeEvent) =>
      onChange(index, { name, prop: { ...prop, required: (event.target as HTMLInputElement).checked } }),
    [index, name, prop, onChange]
  );
  const handleRemove = useCallback(() => onRemove(index), [index, onRemove]);

  return (
    <Flex direction="column" gap={1} className="rounded border border-gray-200 p-2 dark:border-zinc-700">
      <Flex gap={2} items="end">
        <Input value={name} label="Name" placeholder="title" onChange={handleName} size="xs" className="grow basis-0" />
        <Select2 value={prop.type} label="Kind" onChange={handleType} options={TYPES} />
        <Icon
          icon="fas fa-trash-alt"
          onClick={handleRemove}
          title="Remove"
          size="sm"
          cursor="pointer"
          intent="danger"
        />
      </Flex>
      <Input value={prop.description} label="What it is for" onChange={handleDescription} size="xs" />
      {prop.type === 'select' && (
        <Input
          value={(prop.options ?? []).join(', ')}
          label="Choices, comma separated"
          onChange={handleOptions}
          size="xs"
        />
      )}
      <Checkbox checked={prop.required === true} onChange={handleRequired} label="Required" size="xs" />
      {problem && <span className="text-xs text-red-500">{problem}</span>}
    </Flex>
  );
};

export default PropRow;
