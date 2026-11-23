import Input from '@plitzi/plitzi-ui/Input';
import Select from '@plitzi/plitzi-ui/Select';

import { isWindowBound } from '@plitzi/sdk-shared/timeWindows';

import useSettingsUpdate from '../../useSettingsUpdate';

import type { CountdownLabels, CountdownUnit } from '@plitzi/sdk-shared/timeWindows';

type SettingsProps = {
  to?: string;
  largest?: CountdownUnit;
  smallest?: CountdownUnit;
  labels?: CountdownLabels;
  locale?: string;
  onUpdate?: (key: string, value: string | boolean | number) => void;
};

const UNITS: { value: CountdownUnit; label: string }[] = [
  { value: 'days', label: 'Days' },
  { value: 'hours', label: 'Hours' },
  { value: 'minutes', label: 'Minutes' },
  { value: 'seconds', label: 'Seconds' }
];

/** A countdown's settings: what it counts to, the units it says, and how it names them. */
const Settings = ({
  to = '',
  largest = 'days',
  smallest = 'seconds',
  labels = 'long',
  locale = '',
  onUpdate
}: SettingsProps) => {
  const update = useSettingsUpdate(onUpdate);
  const unread = !isWindowBound(to);

  return (
    <div className="flex flex-col gap-4 py-2">
      <Input label="Counts to" size="xs" placeholder="2026-12-01T09:00:00Z" value={to} onChange={update.text('to')} />
      <span className="text-ui-fg-subtle text-xs">
        {unread
          ? 'Not read: write it with its offset — 2026-12-01T09:00:00Z, or +01:00 for CET.'
          : 'Empty, it counts to the end of the time window it is in.'}
      </span>
      <Select label="From" size="xs" value={largest} onChange={update.text('largest')}>
        {UNITS.map(unit => (
          <option key={unit.value} value={unit.value}>
            {unit.label}
          </option>
        ))}
      </Select>
      <Select label="Down to" size="xs" value={smallest} onChange={update.text('smallest')}>
        {UNITS.map(unit => (
          <option key={unit.value} value={unit.value}>
            {unit.label}
          </option>
        ))}
      </Select>
      <Select label="Unit names" size="xs" value={labels} onChange={update.text('labels')}>
        <option value="long">Words (days)</option>
        <option value="short">Short (d, hr)</option>
        <option value="none">None</option>
      </Select>
      <Input label="Language" size="xs" placeholder="The space’s" value={locale} onChange={update.text('locale')} />
      <span className="text-ui-fg-subtle text-xs">
        While editing it counts at the date chosen in the State Manager’s Visitor tab, when one is.
      </span>
    </div>
  );
};

export default Settings;
