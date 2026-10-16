import { useCallback } from 'react';

import { createFunctionValue, DEFAULT_FUNCTION, parseTransforms, serializeTransforms } from './transformFunctions';
import TransformItem from './TransformItem';
import ValueList from '../../../components/ValueList';

import type { TransformFunctionValue } from './transformFunctions';
import type { StyleCategory, StyleValue } from '@plitzi/sdk-shared';

const TRANSFORM_KEYS: StyleCategory[] = ['transform'];

export type TransformProps = {
  value?: StyleValue;
  onChange?: (value: StyleValue | Record<StyleCategory, StyleValue> | boolean) => void;
};

const Transform = ({ value, onChange }: TransformProps) => {
  const transforms = parseTransforms(typeof value === 'string' ? value : '');

  const emit = useCallback(
    (next: TransformFunctionValue[]) => onChange?.(next.length > 0 ? serializeTransforms(next) : ''),
    [onChange]
  );

  const handleRemoveItem = (index: number) => () => emit(transforms.filter((_, i) => i !== index));

  const handleChangeItem = (index: number) => (item: TransformFunctionValue) => {
    emit(transforms.map((transform, i) => (i === index ? item : transform)));
  };

  const handleClickAddItem = useCallback(() => {
    emit([...transforms, createFunctionValue(DEFAULT_FUNCTION)]);
  }, [emit, transforms]);

  return (
    <ValueList label="2D & 3D Transforms" keys={TRANSFORM_KEYS} addLabel="Add transform" onAdd={handleClickAddItem}>
      {transforms.length > 0 &&
        transforms.map((transform, index) => (
          <TransformItem
            key={index}
            value={transform}
            onChange={handleChangeItem(index)}
            onRemove={handleRemoveItem(index)}
          />
        ))}
    </ValueList>
  );
};

export default Transform;
