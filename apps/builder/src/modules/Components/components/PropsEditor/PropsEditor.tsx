import Button from '@plitzi/plitzi-ui/Button';
import Flex from '@plitzi/plitzi-ui/Flex';
import { useCallback } from 'react';

import { propNameProblem } from '@plitzi/sdk-schema/helpers/components';

import PropRow from './PropRow';

import type { PropEntry } from './PropRow';

export type PropsEditorProps = {
  value: PropEntry[];
  onChange: (value: PropEntry[]) => void;
};

/** Why a row's name cannot stand: one the reader cannot read, or one another row already took. */
const problemOf = (entries: PropEntry[], index: number): string | undefined => {
  const { name } = entries[index];
  const problem = propNameProblem(name);
  if (problem) {
    return problem;
  }

  return entries.findIndex(entry => entry.name === name) === index ? undefined : `"${name}" is declared twice`;
};

/**
 * The props a component declares, one row each: the name it is read by (`{{ props.<name> }}`), its kind, what it is
 * for and whether an instance must hand it in.
 */
const PropsEditor = ({ value, onChange }: PropsEditorProps) => {
  const handleAdd = useCallback(
    () => onChange([...value, { name: `prop${value.length + 1}`, prop: { type: 'text', description: '' } }]),
    [value, onChange]
  );
  const handleChange = useCallback(
    (index: number, entry: PropEntry) => onChange(value.map((current, at) => (at === index ? entry : current))),
    [value, onChange]
  );
  const handleRemove = useCallback(
    (index: number) => onChange(value.filter((_entry, at) => at !== index)),
    [value, onChange]
  );

  return (
    <Flex direction="column" gap={2}>
      <span className="text-sm font-semibold">Props</span>
      {value.map((entry, index) => (
        <PropRow
          key={index}
          index={index}
          entry={entry}
          problem={problemOf(value, index)}
          onChange={handleChange}
          onRemove={handleRemove}
        />
      ))}
      <Button size="xs" onClick={handleAdd} iconPlacement="before">
        <Button.Icon icon="fa-solid fa-plus" />
        Add prop
      </Button>
    </Flex>
  );
};

export default PropsEditor;
