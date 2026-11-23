import Button from '@plitzi/plitzi-ui/Button';
import Input from '@plitzi/plitzi-ui/Input';
import { useCallback, useState } from 'react';

import { useBuilderStore } from '@plitzi/sdk-shared/store';

/** An instant as the field shows it: its date and time in UTC, to the minute. */
const fieldOf = (at: number | undefined): string => (at === undefined ? '' : new Date(at).toISOString().slice(0, 16));

const FIELD = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/;

/** What the field says, as an instant in UTC — or nothing it can read. */
const instantOfField = (value: string): number | undefined => {
  const at = FIELD.test(value) ? Date.parse(`${value}:00Z`) : Number.NaN;

  return Number.isNaN(at) ? undefined : at;
};

/**
 * The instant the canvas's preview is shown at, for what the space shows or says by the time (`timeWindow`, `countdown`) — written and read
 * in UTC, as the windows are. Left empty, the editor's own clock.
 */
const SimulatedTime = () => {
  const [simulatedAt, setSimulatedAt] = useBuilderStore('simulatedAt');
  const [text, setText] = useState(() => fieldOf(simulatedAt));
  const unread = text.trim() !== '' && instantOfField(text.trim()) === undefined;

  const handleChange = useCallback(
    (value: string) => {
      setText(value);
      const at = instantOfField(value.trim());
      if (value.trim() === '' || at !== undefined) {
        setSimulatedAt(at);
      }
    },
    [setSimulatedAt]
  );

  const handleNow = useCallback(() => {
    setText('');
    setSimulatedAt(undefined);
  }, [setSimulatedAt]);

  return (
    <section className="border-ui-line flex flex-col gap-2 border-t pt-2">
      <h6 className="text-ui-fg-subtle px-1 text-[10px] font-semibold tracking-wider uppercase">
        For time windows and countdowns
      </h6>
      <Input
        label="Date and time (UTC)"
        size="xs"
        placeholder="2026-12-01T09:00"
        value={text}
        onChange={handleChange}
      />
      {unread && <span className="text-ui-fg-subtle px-1 text-[11px]">Not read: write it as 2026-12-01T09:00.</span>}
      {simulatedAt !== undefined && (
        <Button size="xs" intent="secondary" onClick={handleNow}>
          Back to now
        </Button>
      )}
    </section>
  );
};

export default SimulatedTime;
