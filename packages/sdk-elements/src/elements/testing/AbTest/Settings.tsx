import Input from '@plitzi/plitzi-ui/Input';
import Select from '@plitzi/plitzi-ui/Select';
import { useCallback } from 'react';

import { DEFAULT_EXPERIMENT_SPLIT, isExperimentName } from '@plitzi/sdk-shared/experiments';

import useSettingsUpdate from '../../useSettingsUpdate';

import type { ExperimentVariant } from '@plitzi/sdk-shared/experiments';

type SettingsProps = {
  experiment?: string;
  split?: number;
  builderVariant?: ExperimentVariant;
  onUpdate?: (key: string, value: string | boolean | number) => void;
};

/** What the experiment's name says of it in the panel: running, or why it is not. */
const nameHint = (experiment: string): string => {
  if (experiment === '') {
    return 'Not running yet: every visitor sees A until the experiment has a name.';
  }

  if (!isExperimentName(experiment)) {
    return 'Not running: a name is letters, digits and _, not starting with a digit — heroTest, pricing_v2.';
  }

  return `Visitors keep their variant when they come back. Read it as {{ experiments.${experiment} }} — 'a' or 'b'.`;
};

/** An A/B test's settings: its name, the share of visitors who see B, and the variant the canvas shows. */
const Settings = ({
  experiment = '',
  split = DEFAULT_EXPERIMENT_SPLIT,
  builderVariant = 'a',
  onUpdate
}: SettingsProps) => {
  const update = useSettingsUpdate(onUpdate);

  // A whole share of the visitors: what cannot be read as one is left as it was rather than written as 0, which would
  // end the experiment.
  const handleSplit = useCallback(
    (value: string) => {
      const share = Number(value);
      if (value.trim() !== '' && Number.isFinite(share)) {
        onUpdate?.('split', Math.min(100, Math.max(0, Math.round(share))));
      }
    },
    [onUpdate]
  );

  return (
    <div className="flex flex-col gap-4 py-2">
      <Select label="Show in the builder" value={builderVariant} onChange={update.text('builderVariant')} size="xs">
        <option value="a">Variant A</option>
        <option value="b">Variant B</option>
      </Select>
      <Input
        label="Experiment"
        size="xs"
        placeholder="heroTest"
        value={experiment}
        onChange={update.text('experiment')}
      />
      <span className="text-ui-fg-subtle text-xs">{nameHint(experiment)}</span>
      <Input
        type="number"
        label="Visitors who see B (%)"
        size="xs"
        min={0}
        max={100}
        value={String(split)}
        onChange={handleSplit}
      />
      <span className="text-ui-fg-subtle text-xs">
        {100 - split}% see A, {split}% see B. 0 or 100 ends the experiment: everybody sees that side.
      </span>
    </div>
  );
};

export default Settings;
