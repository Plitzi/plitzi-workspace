import Icon from '@plitzi/plitzi-ui/Icon';
import { useCallback } from 'react';

import TransformationItem from './TransformItem';
import InspectorLabel from '../../../components/InspectorLabel';

import type { StyleCategory, StyleValue } from '@plitzi/sdk-shared';
import type { MouseEvent } from 'react';

export type TransformProps = {
  value?: StyleValue;
  onChange?: (value: StyleValue | Record<StyleCategory, StyleValue> | boolean) => void;
};

const Transform = ({ value, onChange }: TransformProps) => {
  let transforms: string[] = [];
  if (value && value !== '') {
    transforms =
      (value as string).match(/((translate3d|scale3d|skew)\([0-9a-z-, .%]+\))|(rotateX.*rotateZ\([0-9a-z%]+\))/gim) ??
      [];
  }

  const handleClickRemoveItem = (index: number) => (e: MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    transforms.splice(index, 1);
    if (transforms.length > 0) {
      onChange?.(transforms.join(' '));
    } else {
      onChange?.('');
    }
  };

  const handleChangeItem = (index: number) => (transformItemValue: string) => {
    if (transformItemValue !== transforms[index]) {
      transforms[index] = transformItemValue;
      onChange?.(transforms.join(' '));
    }
  };

  const handleClickAddItem = useCallback(() => {
    if (value) {
      onChange?.(`${value} translate3d(0px, 0px, 0px)`);
    } else {
      onChange?.('translate3d(0px, 0px, 0px)');
    }
  }, [onChange, value]);

  return (
    <>
      <div className="flex justify-between">
        <InspectorLabel keyValue={['transform']}>2D & 3D Transforms</InspectorLabel>
        <Icon className="cursor-pointer" icon="fas fa-plus" onClick={handleClickAddItem} />
      </div>
      {transforms.length > 0 && (
        <div className="flex flex-col">
          {transforms.map((transform, index) => (
            <TransformationItem
              key={index}
              value={transform}
              onChange={handleChangeItem(index)}
              onRemove={handleClickRemoveItem(index)}
            />
          ))}
        </div>
      )}
    </>
  );
};

export default Transform;
