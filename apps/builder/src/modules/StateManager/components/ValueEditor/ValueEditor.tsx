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
  // A key the page has not set reads as a dash, not as an empty field: a list of them is quiet, and one is set by
  // choosing it.
  const [setting, setSetting] = useState(false);

  const handleToggle = useCallback((e: ChangeEvent<HTMLInputElement>) => onChange(e.target.checked), [onChange]);

  const apply = useCallback(() => {
    if (draft !== undefined && draft !== '') {
      onChange(typeof value === 'number' ? Number(draft) : parseTyped(draft));
    }

    setDraft(undefined);
    setSetting(false);
  }, [draft, onChange, value]);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter') {
        apply();
      }

      if (e.key === 'Escape') {
        setDraft(undefined);
        setSetting(false);
      }
    },
    [apply]
  );

  if (value === undefined && !setting) {
    return (
      <button
        type="button"
        className="text-ui-fg-subtle hover:bg-ui-hover hover:text-ui-fg w-full cursor-pointer rounded-sm px-1.5 py-0.5 text-left text-xs"
        title="Not set yet — choose it to give it a value"
        onClick={() => setSetting(true)}
      >
        —
      </button>
    );
  }

  if (typeof value === 'boolean') {
    return <Switch size="xs" checked={value} aria-label={value ? 'On' : 'Off'} onChange={handleToggle} />;
  }

  return (
    <Input
      size="xs"
      type={typeof value === 'number' ? 'number' : 'text'}
      className={{ input: 'font-mono' }}
      value={shown}
      placeholder={value === undefined ? 'true, 3, "text", [1, 2]…' : undefined}
      autoFocus={setting}
      onChange={setDraft}
      onBlur={apply}
      onKeyDown={handleKeyDown}
    />
  );
};

export default ValueEditor;
