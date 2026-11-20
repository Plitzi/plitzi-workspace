import Input from '@plitzi/plitzi-ui/Input';

import { isWindowBound } from '@plitzi/sdk-shared/timeWindows';

import useSettingsUpdate from '../../useSettingsUpdate';

type SettingsProps = {
  startsAt?: string;
  endsAt?: string;
  onUpdate?: (key: string, value: string | boolean | number) => void;
};

/** What a bound says of itself in the panel: read, or why it is not. */
const boundHint = (value: string): string | undefined =>
  isWindowBound(value) ? undefined : 'Not read: write it with its offset — 2026-12-01T09:00:00Z, or +01:00 for CET.';

/** A time window's settings: when it starts and ends showing what it holds. */
const Settings = ({ startsAt = '', endsAt = '', onUpdate }: SettingsProps) => {
  const update = useSettingsUpdate(onUpdate);
  const fromHint = boundHint(startsAt);
  const untilHint = boundHint(endsAt);

  return (
    <div className="flex flex-col gap-4 py-2">
      <Input
        label="Starts at"
        size="xs"
        placeholder="2026-12-01T09:00:00Z"
        value={startsAt}
        onChange={update.text('startsAt')}
      />
      {fromHint && <span className="text-ui-fg-subtle text-xs">{fromHint}</span>}
      <Input
        label="Ends at"
        size="xs"
        placeholder="2026-12-08T09:00:00Z"
        value={endsAt}
        onChange={update.text('endsAt')}
      />
      {untilHint && <span className="text-ui-fg-subtle text-xs">{untilHint}</span>}
      <span className="text-ui-fg-subtle text-xs">
        Shown from the first instant up to the second; either left empty is no bound. Times in UTC (Z) or with their
        offset. While editing the canvas always shows it; its preview shows it at the date chosen in the State Manager’s
        Visitor tab.
      </span>
    </div>
  );
};

export default Settings;
