import Input from '@plitzi/plitzi-ui/Input';
import Select from '@plitzi/plitzi-ui/Select';

import { EXPERIMENT_VARIANTS, isExperimentName } from '@plitzi/sdk-shared/experiments';

import useSettingsUpdate from '../../useSettingsUpdate';

import type { ExperimentVariant } from '@plitzi/sdk-shared/experiments';

type SettingsProps = {
  experiment?: string;
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

  return `Visitors keep their variant when they come back. Read it as {{ experiments.${experiment} }} — 'a', 'b'…`;
};

/** An A/B test's settings: its name and the variant the canvas shows. Each variant's share is its own weight. */
const Settings = ({ experiment = '', builderVariant = 'a', onUpdate }: SettingsProps) => {
  const update = useSettingsUpdate(onUpdate);

  return (
    <div className="flex flex-col gap-4 py-2">
      <Select label="Show in the builder" value={builderVariant} onChange={update.text('builderVariant')} size="xs">
        {EXPERIMENT_VARIANTS.map(variant => (
          <option key={variant} value={variant}>
            Variant {variant.toUpperCase()}
          </option>
        ))}
      </Select>
      <Input
        label="Experiment"
        size="xs"
        placeholder="heroTest"
        value={experiment}
        onChange={update.text('experiment')}
      />
      <span className="text-ui-fg-subtle text-xs">{nameHint(experiment)}</span>
      <span className="text-ui-fg-subtle text-xs">
        The variants are A, B… in their order. Each shows to its weight’s share of the visitors, set on the variant.
      </span>
    </div>
  );
};

export default Settings;
