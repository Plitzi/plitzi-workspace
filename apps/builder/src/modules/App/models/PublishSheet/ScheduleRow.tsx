import { useCallback } from 'react';

import type { ChangeEvent } from 'react';

export type ScheduleRowProps = {
  /** The moment, as the person's own clock reads it (`datetime-local`). */
  value: string;
  onChange: (value: string | undefined) => void;
  onCancel: () => void;
};

/** When to publish instead of now: one moment in the person's own time, and a way back to publishing now. */
const ScheduleRow = ({ value, onChange, onCancel }: ScheduleRowProps) => {
  const handleChange = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => onChange(event.target.value || undefined),
    [onChange]
  );

  return (
    <div className="bg-ui-raised flex flex-wrap items-center gap-2 rounded-lg px-3 py-2 text-xs">
      <i className="fa-solid fa-clock text-ui-fg-subtle" aria-hidden />
      <label className="text-ui-fg flex items-center gap-2">
        Publish on
        <input
          type="datetime-local"
          value={value}
          className="border-ui-line bg-ui-panel text-ui-fg rounded-md border px-1.5 py-1 text-xs"
          onChange={handleChange}
        />
      </label>
      <span className="text-ui-fg-subtle">your time</span>
      <button type="button" className="text-ui-fg-subtle hover:text-ui-fg ml-auto underline" onClick={onCancel}>
        Publish now instead
      </button>
    </div>
  );
};

export default ScheduleRow;
