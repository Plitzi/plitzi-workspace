import Button from '@plitzi/plitzi-ui/Button';
import Form from '@plitzi/plitzi-ui/Form';
import Heading from '@plitzi/plitzi-ui/Heading';
import QueryBuilder from '@plitzi/plitzi-ui/QueryBuilder';
import { useCallback } from 'react';

import type { Field, RuleGroup } from '@plitzi/plitzi-ui/QueryBuilder';

export type FlagRuleProps = {
  index: number;
  last: boolean;
  fields: Record<string, Field>;
  onRemove: (index: number) => void;
  onMove: (from: number, to: number) => void;
};

/** One rule of a flag: the value it gives, and when. Rules are read top to bottom and the first that matches wins. */
const FlagRule = ({ index, last, fields, onRemove, onMove }: FlagRuleProps) => {
  const handleRemove = useCallback(() => onRemove(index), [index, onRemove]);
  const handleUp = useCallback(() => onMove(index, index - 1), [index, onMove]);
  const handleDown = useCallback(() => onMove(index, index + 1), [index, onMove]);

  return (
    <div className="flex min-w-0 flex-col gap-2 rounded-sm border border-gray-300 p-2 dark:border-zinc-700">
      <div className="flex items-center justify-between gap-2">
        <Form.Switch name={`rules.${index}.value`} label="Turns the flag on" size="xs" />
        <div className="flex items-center gap-1">
          {index > 0 && (
            <Button size="xs" intent="secondary" title="Earlier" onClick={handleUp}>
              <Button.Icon icon="fa-solid fa-arrow-up" />
            </Button>
          )}
          {!last && (
            <Button size="xs" intent="secondary" title="Later" onClick={handleDown}>
              <Button.Icon icon="fa-solid fa-arrow-down" />
            </Button>
          )}
          <Button size="xs" intent="secondary" title="Remove rule" onClick={handleRemove}>
            <Button.Icon icon="fa-solid fa-trash" />
          </Button>
        </div>
      </div>
      <Form.Custom
        name={`rules.${index}.when`}
        render={({ field: { ref, value, onChange }, fieldState: { error } }) => (
          <div className="flex flex-col gap-1" ref={ref}>
            <Heading as="h5">When</Heading>
            <QueryBuilder
              direction="vertical"
              intent="gray"
              className="w-full"
              query={value as RuleGroup}
              fields={fields}
              onChange={onChange}
              showBranches
              error={!!error?.message}
            />
          </div>
        )}
      />
    </div>
  );
};

export default FlagRule;
