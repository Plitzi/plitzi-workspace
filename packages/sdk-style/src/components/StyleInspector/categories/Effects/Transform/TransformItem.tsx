import ContainerFloating from '@plitzi/plitzi-ui/ContainerFloating';
import Icon from '@plitzi/plitzi-ui/Icon';
import { useCallback, useMemo } from 'react';

import {
  createFunctionValue,
  getFunctionSpec,
  serializeTransform,
  TRANSFORM_FUNCTIONS,
  unitsForKind
} from './transformFunctions';
import CategoryOption from '../../../components/CategoryOption';

import type { TransformArgSpec, TransformFunctionValue } from './transformFunctions';
import type { StyleCategory, StyleValue } from '@plitzi/sdk-shared';
import type { MouseEvent } from 'react';

export type TransformItemProps = {
  value: TransformFunctionValue;
  onChange?: (value: TransformFunctionValue) => void;
  onRemove?: (e: MouseEvent) => void;
};

const groupedFunctions = TRANSFORM_FUNCTIONS.reduce<{ category: string; specs: typeof TRANSFORM_FUNCTIONS }[]>(
  (groups, spec) => {
    const group = groups.find(item => item.category === spec.category);
    if (group) {
      group.specs.push(spec);
    } else {
      groups.push({ category: spec.category, specs: [spec] });
    }

    return groups;
  },
  []
);

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
    <ContainerFloating className="w-full min-w-0" closeOnClick={false} containerTopOffset={5}>
      <ContainerFloating.Trigger className="flex w-full min-w-0 cursor-pointer items-center justify-between gap-1 rounded-sm border border-gray-300 bg-white px-2 py-0.5 select-none hover:bg-gray-100 dark:border-zinc-600 dark:bg-zinc-800 dark:hover:bg-zinc-700/60">
        <div className="min-w-0 truncate text-xs">{display}</div>
        <Icon size="xs" icon="fas fa-trash-alt" onClick={onRemove} intent="danger" title="Remove" />
      </ContainerFloating.Trigger>
      <ContainerFloating.Content className="w-[240px]">
        <div className="flex w-full flex-col gap-2 p-2">
          <CategoryOption value={value.name} onChange={handleChangeName} type="select">
            {groupedFunctions.map(group => (
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
          <div className="flex flex-col gap-1.5">
            {argSpecs.map((argSpec, index) => (
              <CategoryOption
                key={`${argSpec.label}-${index}`}
                label={argSpec.label}
                value={args[index]}
                onChange={handleChangeArg(index)}
                type="metric"
                direction="row"
                units={unitsForKind(argSpec.kind)}
                step={argSpec.kind === 'number' ? 0.1 : 1}
                min={-Infinity}
              />
            ))}
          </div>
        </div>
      </ContainerFloating.Content>
    </ContainerFloating>
  );
};

export default TransformItem;
