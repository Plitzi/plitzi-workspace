import clsx from 'clsx';
import { useCallback, useState } from 'react';

export type ValueJsonProps = { value: unknown; onChange: (value: unknown) => void };

/** An object or a list, edited whole as JSON; applied when it is valid and left. */
const ValueJson = ({ value, onChange }: ValueJsonProps) => {
  const [draft, setDraft] = useState(() => JSON.stringify(value, null, 2));
  const [invalid, setInvalid] = useState(false);

  const handleBlur = useCallback(() => {
    try {
      onChange(JSON.parse(draft));
      setInvalid(false);
    } catch {
      setInvalid(true);
    }
  }, [draft, onChange]);

  return (
    <div className="flex flex-col gap-1">
      <textarea
        className={clsx(
          'bg-ui-field text-ui-fg min-h-20 w-full rounded-sm border p-1.5 font-mono text-[11px] leading-snug outline-none',
          { 'border-red-500': invalid, 'border-ui-line-strong focus:border-primary-500': !invalid }
        )}
        spellCheck={false}
        value={draft}
        onChange={e => setDraft(e.target.value)}
        onBlur={handleBlur}
      />
      {invalid && <span className="text-[11px] text-red-600 dark:text-red-400">Not valid JSON: not applied.</span>}
    </div>
  );
};

export default ValueJson;
