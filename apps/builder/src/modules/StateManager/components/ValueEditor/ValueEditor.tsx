import Input from '@plitzi/plitzi-ui/Input';
import Switch from '@plitzi/plitzi-ui/Switch';
import { useCallback, useState } from 'react';

import { parseTyped } from '../../helpers';

import type { ChangeEvent, KeyboardEvent } from 'react';

export type ValueEditorProps = {
  /** Undefined: a key the space uses that the page has not set yet. */
  value: unknown;
  onChange: (value: unknown) => void;
};

const textOf = (value: unknown): string =>
  value === undefined ? '' : typeof value === 'string' ? value : JSON.stringify(value);

/**
 * One value of the state, edited as what it is: a toggle for true or false, a number field for a number, and for
 * anything else a field read as typed — JSON when it is (`[1, 2]`, `{"a": 1}`), the words otherwise — applied on Enter
 * or when it is left, so the page is not redrawn at every keystroke.
 */
const ValueEditor = ({ value, onChange }: ValueEditorProps) => {
  const [draft, setDraft] = useState<string | undefined>(undefined);
  const shown = draft ?? textOf(value);

  const handleToggle = useCallback((e: ChangeEvent<HTMLInputElement>) => onChange(e.target.checked), [onChange]);

  const apply = useCallback(() => {
    if (draft !== undefined) {
      onChange(typeof value === 'number' ? Number(draft) : parseTyped(draft));
      setDraft(undefined);
    }
  }, [draft, onChange, value]);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter') {
        apply();
      }

      if (e.key === 'Escape') {
        setDraft(undefined);
      }
    },
    [apply]
  );

  if (typeof value === 'boolean') {
    return <Switch size="xs" checked={value} aria-label={value ? 'On' : 'Off'} onChange={handleToggle} />;
  }

  return (
    <Input
      size="xs"
      type={typeof value === 'number' ? 'number' : 'text'}
      className={{ input: 'font-mono' }}
      value={shown}
      placeholder={value === undefined ? 'not set' : undefined}
      onChange={setDraft}
      onBlur={apply}
      onKeyDown={handleKeyDown}
    />
  );
};

export default ValueEditor;
