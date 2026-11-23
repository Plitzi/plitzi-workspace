import Select from '@plitzi/plitzi-ui/Select';
import { useCallback, useMemo } from 'react';

import {
  declaredExperiments,
  isExperimentVariant,
  variantAt,
  withForcedExperiment
} from '@plitzi/sdk-shared/experiments';
import { useBuilderStore } from '@plitzi/sdk-shared/store';

import type { ExperimentAssignments } from '@plitzi/sdk-shared/experiments';

const NONE: ExperimentAssignments = {};

const OWN = 'own';

type ExperimentRowProps = {
  name: string;
  weights: number[];
  forced: ExperimentAssignments;
  onForce: (next: ExperimentAssignments) => void;
};

const ExperimentRow = ({ name, weights, forced, onForce }: ExperimentRowProps) => {
  const handleChange = useCallback(
    (value: string) => onForce(withForcedExperiment(forced, name, isExperimentVariant(value) ? value : undefined)),
    [forced, name, onForce]
  );

  return (
    <Select label={name} value={forced[name] ?? OWN} onChange={handleChange} size="xs">
      <option value={OWN}>As its settings show it</option>
      {weights.map((weight, index) => {
        const variant = variantAt(index);

        return (
          variant && (
            <option key={variant} value={variant}>
              Variant {variant.toUpperCase()} (weight {weight})
            </option>
          )
        );
      })}
    </Select>
  );
};

/**
 * The variant of each of the space's A/B tests the canvas's visitor is shown in its preview — as each test's settings
 * show it until one is chosen. The builder's forcing: never kept, never a visitor's.
 */
const ExperimentVariants = () => {
  const [[flat, components]] = useBuilderStore(['schema.flat', 'schema.components']);
  const [forced = NONE, setForced] = useBuilderStore('experiments.qa');
  const declared = useMemo(() => declaredExperiments({ flat, components }), [flat, components]);
  const names = Object.keys(declared);

  if (names.length === 0) {
    return null;
  }

  return (
    <section className="border-ui-line flex flex-col gap-2 border-t pt-2">
      <h6 className="text-ui-fg-subtle px-1 text-[10px] font-semibold tracking-wider uppercase">
        For variants by chance
      </h6>
      {names.map(name => (
        <ExperimentRow key={name} name={name} weights={declared[name].weights} forced={forced} onForce={setForced} />
      ))}
    </section>
  );
};

export default ExperimentVariants;
