import Input from '@plitzi/plitzi-ui/Input';
import { useCallback } from 'react';

import { DEFAULT_VARIANT_WEIGHT } from '@plitzi/sdk-shared/experiments';

type SettingsProps = {
  weight?: number;
  onUpdate?: (key: string, value: string | boolean | number) => void;
};

/** A variant's settings: its weight. Its place among the A/B test's variants says which letter it is. */
const Settings = ({ weight = DEFAULT_VARIANT_WEIGHT, onUpdate }: SettingsProps) => {
  // A whole share, 0–100: what cannot be read as one is left as it was rather than written as 0, which would take the
  // variant out of the experiment.
  const handleWeight = useCallback(
    (value: string) => {
      const share = Number(value);
      if (value.trim() !== '' && Number.isFinite(share)) {
        onUpdate?.('weight', Math.min(100, Math.max(0, Math.round(share))));
      }
    },
    [onUpdate]
  );

  return (
    <div className="flex flex-col gap-4 py-2">
      <Input type="number" label="Weight" size="xs" min={0} max={100} value={String(weight)} onChange={handleWeight} />
      <span className="text-ui-fg-subtle text-xs">
        Its share of the visitors against the other variants’ weights: two at 50 split them in half, 70 and 30 show this
        one to 70%. 0 shows it to nobody. The first variant is A, the second B, in the A/B test’s order.
      </span>
    </div>
  );
};

export default Settings;
