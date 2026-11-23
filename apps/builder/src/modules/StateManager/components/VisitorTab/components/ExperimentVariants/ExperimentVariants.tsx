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

const NO_NAMES: string[] = [];

const DRAW = 'draw';

type ExperimentRowProps = {
  name: string;
  weights: number[];
  shown: ExperimentAssignments;
  picked: string[];
  onShow: (shown: ExperimentAssignments, picked: string[]) => void;
};

const ExperimentRow = ({ name, weights, shown, picked, onShow }: ExperimentRowProps) => {
  const isPicked = picked.includes(name);
  const total = weights.reduce((sum, weight) => sum + weight, 0);

  // A variant picked by hand sets the shares aside; Draw lets them decide again — the preview draws it anew.
  const handleChange = useCallback(
    (value: string) => {
      const others = picked.filter(each => each !== name);
      onShow(
        withForcedExperiment(shown, name, isExperimentVariant(value) ? value : undefined),
        isExperimentVariant(value) ? [...others, name] : others
      );
    },
    [name, onShow, picked, shown]
  );

  const now = !isPicked && Object.hasOwn(shown, name) ? ` — now ${shown[name].toUpperCase()}` : '';

  return (
    <Select
      label={name}
      value={isPicked && Object.hasOwn(shown, name) ? shown[name] : DRAW}
      onChange={handleChange}
      size="xs"
    >
      <option value={DRAW}>Drawn by its shares{now}</option>
      {weights.map((weight, index) => {
        const variant = variantAt(index);

        return (
          variant && (
            <option key={variant} value={variant}>
              Variant {variant.toUpperCase()} ({total > 0 ? Math.round((weight / total) * 100) : 0}%)
            </option>
          )
        );
      })}
    </Select>
  );
};

/**
 * The variant of each of the space's tests by chance the canvas's preview shows: drawn by its shares, as a visitor's
 * page draws it, until one is picked by hand. The builder's own: never kept, never a visitor's.
 */
const ExperimentVariants = () => {
  const [[flat, components]] = useBuilderStore(['schema.flat', 'schema.components']);
  const [shown = NONE, setShown] = useBuilderStore('experiments.qa');
  const [picked = NO_NAMES, setPicked] = useBuilderStore('previewPicked');
  const declared = useMemo(() => declaredExperiments({ flat, components }), [flat, components]);
  const names = Object.keys(declared);

  const handleShow = useCallback(
    (next: ExperimentAssignments, nextPicked: string[]) => {
      setPicked(nextPicked);
      setShown(next);
    },
    [setPicked, setShown]
  );

  if (names.length === 0) {
    return null;
  }

  return (
    <section className="border-ui-line flex flex-col gap-2 border-t pt-2">
      <h6 className="text-ui-fg-subtle px-1 text-[10px] font-semibold tracking-wider uppercase">
        For variants by chance
      </h6>
      {names.map(name => (
        <ExperimentRow
          key={name}
          name={name}
          weights={declared[name].weights}
          shown={shown}
          picked={picked}
          onShow={handleShow}
        />
      ))}
    </section>
  );
};

export default ExperimentVariants;
