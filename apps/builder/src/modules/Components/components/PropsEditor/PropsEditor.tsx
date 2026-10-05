import Button from '@plitzi/plitzi-ui/Button';
import { useCallback } from 'react';

import { propNameProblem } from '@plitzi/sdk-schema/helpers/components';

import PropRow from './PropRow';
import FormSection from '../FormSection';

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
    <FormSection
      title="Props"
      hint={
        <>
          What an instance hands in, read inside the component as <code>{'{{ props.<name> }}'}</code>.
        </>
      }
    >
      {value.length === 0 && (
        <span className="text-xs text-gray-500 dark:text-zinc-400">None: every instance renders the same.</span>
      )}
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
      <Button size="xs" intent="secondary" onClick={handleAdd} iconPlacement="before" className="self-start">
        <Button.Icon icon="fa-solid fa-plus" />
        Add prop
      </Button>
    </FormSection>
  );
};

export default PropsEditor;
