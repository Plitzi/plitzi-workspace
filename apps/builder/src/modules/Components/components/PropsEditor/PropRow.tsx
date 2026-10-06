import Checkbox from '@plitzi/plitzi-ui/Checkbox';
import Flex from '@plitzi/plitzi-ui/Flex';
import Icon from '@plitzi/plitzi-ui/Icon';
import Input from '@plitzi/plitzi-ui/Input';
import Select2 from '@plitzi/plitzi-ui/Select2';
import { useCallback } from 'react';

import { TYPES, isPropType } from './helpers';

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
    (event: ChangeEvent<HTMLInputElement>) =>
      onChange(index, { name, prop: { ...prop, required: event.target.checked } }),
    [index, name, prop, onChange]
  );
  const handleRemove = useCallback(() => onRemove(index), [index, onRemove]);

  return (
    <Flex
      direction="column"
      gap={1.5}
      className="rounded-md border border-gray-200 bg-gray-50/60 p-2 dark:border-zinc-700 dark:bg-zinc-800/40"
    >
      {/* What identifies the prop on one line: its name flexes, its kind keeps the width its longest label needs. */}
      <div className="grid grid-cols-[minmax(0,1fr)_8rem_auto_auto] items-end gap-2">
        <Input value={name} label="Name" placeholder="title" onChange={handleName} size="xs" />
        <Select2 value={prop.type} label="Kind" onChange={handleType} options={TYPES} size="xs" clearable={false} />
        <Checkbox
          checked={prop.required === true}
          onChange={handleRequired}
          label="Required"
          size="xs"
          className="mb-1.5"
        />
        <Icon
          icon="fas fa-trash-alt"
          onClick={handleRemove}
          title="Remove this prop"
          size="xs"
          cursor="pointer"
          intent="danger"
          className="mb-2"
        />
      </div>
      {name && !problem && (
        <span className="font-mono text-[11px] text-gray-500 dark:text-zinc-400">{`{{ props.${name} }}`}</span>
      )}
      {problem && <span className="text-xs text-red-500">{problem}</span>}
      {/* What it is for, and — for a choice — its options beside it. */}
      <div className={prop.type === 'select' ? 'grid grid-cols-2 gap-2' : 'grid grid-cols-1'}>
        <Input
          value={prop.description}
          label="What it is for"
          placeholder="Shown to whoever fills it in"
          onChange={handleDescription}
          size="xs"
        />
        {prop.type === 'select' && (
          <Input
            value={(prop.options ?? []).join(', ')}
            label="Choices, comma separated"
            onChange={handleOptions}
            size="xs"
          />
        )}
      </div>
    </Flex>
  );
};

export default PropRow;
