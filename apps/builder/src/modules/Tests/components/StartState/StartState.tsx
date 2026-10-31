import Button from '@plitzi/plitzi-ui/Button';
import Input from '@plitzi/plitzi-ui/Input';
import { useCallback, useState } from 'react';

import { valueOf, valueText } from '../../helpers';

export type StartStateProps = {
  /** The state the journey starts with, by key — none: a new visitor's. */
  state?: Record<string, unknown>;
  locked: boolean;
  onChange: (state: Record<string, unknown> | undefined) => void;
};

/**
 * Where a journey starts: as a new visitor, or with the page's state already set — a basket full, a step already past —
 * so a case is reached without the steps that lead to it. Each value set is a chip; a key and a value add one.
 */
const StartState = ({ state = {}, locked, onChange }: StartStateProps) => {
  const [adding, setAdding] = useState(false);
  const [key, setKey] = useState('');
  const [value, setValue] = useState('');
  const entries = Object.entries(state);

  const handleAdd = useCallback(() => {
    const name = key.trim();
    if (!name) {
      return;
    }

    onChange({ ...state, [name]: valueOf(value) });
    setKey('');
    setValue('');
    setAdding(false);
  }, [key, onChange, state, value]);
  const handleRemove = useCallback(
    (name: string) => () => {
      const rest = Object.fromEntries(Object.entries(state).filter(([each]) => each !== name));
      onChange(Object.keys(rest).length > 0 ? rest : undefined);
    },
    [onChange, state]
  );
  const handleOpen = useCallback(() => setAdding(true), []);
  const handleCancel = useCallback(() => setAdding(false), []);

  return (
    <div
      className="flex flex-wrap items-center gap-2 text-xs text-zinc-600 dark:text-zinc-300"
      aria-label="What it starts with"
    >
      <i className="fa-solid fa-flag text-[11px] text-zinc-400" />
      <span>{entries.length > 0 ? 'Starts with' : 'Starts as a new visitor'}</span>
      {entries.map(([name, each]) => (
        <span
          key={name}
          className="flex items-center gap-1 rounded border border-gray-300 px-1.5 py-0.5 font-mono dark:border-zinc-700"
        >
          {name} = {valueText(each)}
          {!locked && (
            <button
              type="button"
              aria-label={`Start without ${name}`}
              className="text-zinc-400 hover:text-red-600"
              onClick={handleRemove(name)}
            >
              <i className="fa-solid fa-xmark" />
            </button>
          )}
        </span>
      ))}
      {!locked && !adding && (
        <Button size="xs" intent="secondary" iconPlacement="before" onClick={handleOpen}>
          <Button.Icon icon="fa-solid fa-plus" />
          {entries.length > 0 ? 'Another value' : 'Start with a state'}
        </Button>
      )}
      {!locked && adding && (
        <>
          <div className="w-32">
            <Input size="xs" name="key" aria-label="State key" placeholder="basket" value={key} onChange={setKey} />
          </div>
          <span>=</span>
          <div className="w-48">
            <Input
              size="xs"
              name="value"
              aria-label="Its value"
              placeholder='[{"id":"croissant"}] or words'
              value={value}
              onChange={setValue}
            />
          </div>
          <Button size="xs" disabled={!key.trim()} onClick={handleAdd}>
            Add
          </Button>
          <Button size="xs" intent="secondary" onClick={handleCancel}>
            Cancel
          </Button>
        </>
      )}
    </div>
  );
};

export default StartState;
