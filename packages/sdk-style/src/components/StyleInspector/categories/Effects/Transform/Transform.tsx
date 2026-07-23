import Icon from '@plitzi/plitzi-ui/Icon';
import { useCallback } from 'react';

import { createFunctionValue, DEFAULT_FUNCTION, parseTransforms, serializeTransforms } from './transformFunctions';
import TransformItem from './TransformItem';
import InspectorLabel from '../../../components/InspectorLabel';

import type { TransformFunctionValue } from './transformFunctions';
import type { StyleCategory, StyleValue } from '@plitzi/sdk-shared';
import type { MouseEvent } from 'react';

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

  const handleRemoveItem = (index: number) => (e: MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    emit(transforms.filter((_, i) => i !== index));
  };

  const handleChangeItem = (index: number) => (item: TransformFunctionValue) => {
    emit(transforms.map((transform, i) => (i === index ? item : transform)));
  };

  const handleClickAddItem = useCallback(() => {
    emit([...transforms, createFunctionValue(DEFAULT_FUNCTION)]);
  }, [emit, transforms]);

  return (
    <>
      <div className="flex justify-between">
        <InspectorLabel keyValue={['transform']}>2D & 3D Transforms</InspectorLabel>
        <Icon className="cursor-pointer" icon="fas fa-plus" onClick={handleClickAddItem} />
      </div>
      {transforms.length > 0 && (
        <div className="flex flex-col gap-2">
          {transforms.map((transform, index) => (
            <TransformItem
              key={index}
              value={transform}
              onChange={handleChangeItem(index)}
              onRemove={handleRemoveItem(index)}
            />
          ))}
        </div>
      )}
    </>
  );
};

export default Transform;
