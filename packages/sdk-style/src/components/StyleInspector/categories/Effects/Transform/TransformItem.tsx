import { useCallback, useMemo } from 'react';

import {
  createFunctionValue,
  getFunctionSpec,
  serializeTransform,
  TRANSFORM_FUNCTION_GROUPS,
  unitsForKind
} from './transformFunctions';
import CategoryOption from '../../../components/CategoryOption';
import ValueListItem from '../../../components/ValueListItem';

import type { TransformArgSpec, TransformFunctionValue } from './transformFunctions';
import type { StyleCategory, StyleValue } from '@plitzi/sdk-shared';

export type TransformItemProps = {
  value: TransformFunctionValue;
  onChange?: (value: TransformFunctionValue) => void;
  onRemove: () => void;
};

const TransformItem = ({ value, onRemove, onChange }: TransformItemProps) => {
  const spec = getFunctionSpec(value.name);
  const argSpecs: TransformArgSpec[] = useMemo(
    () =>
      spec ? spec.args : value.args.map((_, index) => ({ label: `#${index + 1}`, kind: 'length', default: '0px' })),
    [spec, value.args]
  );

  const args = useMemo(
    () => argSpecs.map((argSpec, index) => value.args[index] ?? argSpec.default),
    [argSpecs, value.args]
  );

  const handleChangeName = useCallback(
    (name: StyleValue | Record<StyleCategory, StyleValue> | boolean) => onChange?.(createFunctionValue(name as string)),
    [onChange]
  );

  const handleChangeArg = useCallback(
    (index: number) => (argValue: StyleValue | Record<StyleCategory, StyleValue> | boolean) => {
      const nextArgs = argSpecs.map((argSpec, i) =>
        i === index ? (argValue as string) : (value.args[i] ?? argSpec.default)
      );
      onChange?.({ name: value.name, args: nextArgs });
    },
    [argSpecs, onChange, value.args, value.name]
  );

  const display = serializeTransform({ name: value.name, args });

  return (
    <ValueListItem summary={display} title="Transform" removeLabel="Remove transform" onRemove={onRemove}>
      <CategoryOption label="Function" value={value.name} onChange={handleChangeName} type="select">
        {TRANSFORM_FUNCTION_GROUPS.map(group => (
          <optgroup key={group.category} label={group.category}>
            {group.specs.map(functionSpec => (
              <option key={functionSpec.name} value={functionSpec.name}>
                {functionSpec.label}
              </option>
            ))}
          </optgroup>
        ))}
        {!spec && (
          <optgroup label="Other">
            <option value={value.name}>{value.name}</option>
          </optgroup>
        )}
      </CategoryOption>
      <div className="grid grid-cols-2 gap-2">
        {argSpecs.map((argSpec, index) => (
          <CategoryOption
            key={`${argSpec.label}-${index}`}
            label={argSpec.label}
            value={args[index]}
            onChange={handleChangeArg(index)}
            type="metric"
            units={unitsForKind(argSpec.kind)}
            step={argSpec.kind === 'number' ? 0.1 : 1}
            min={-Infinity}
          />
        ))}
      </div>
    </ValueListItem>
  );
};

export default TransformItem;
