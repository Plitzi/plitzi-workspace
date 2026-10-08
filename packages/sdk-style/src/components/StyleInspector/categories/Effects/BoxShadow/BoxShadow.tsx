import { useCallback } from 'react';

import ShadowItem from '../../../components/ShadowItem';
import ValueList from '../../../components/ValueList';
import { splitByCommaOutsideParens } from '../../../cssValues';
import { DEFAULT_SHADOW, serializeShadow } from '../../../shadowValue';

import type { StyleCategory, StyleValue } from '@plitzi/sdk-shared';

export type BoxShadowProps = {
  value?: StyleValue;
  onChange?: (value: StyleValue | Record<StyleCategory, StyleValue> | boolean) => void;
};

const BOX_SHADOW_KEYS: StyleCategory[] = ['box-shadow'];

const BoxShadow = ({ value = '', onChange }: BoxShadowProps) => {
  const shadows = typeof value === 'string' && value !== '' ? splitByCommaOutsideParens(value).map(s => s.trim()) : [];

  const emit = useCallback((next: string[]) => onChange?.(next.length > 0 ? next.join(', ') : ''), [onChange]);

  const handleRemoveItem = (index: number) => () => emit(shadows.filter((_, i) => i !== index));

  const handleChangeItem = (index: number) => (item: string) => {
    if (item !== shadows[index]) {
      emit(shadows.map((shadow, i) => (i === index ? item : shadow)));
    }
  };

  const handleAdd = () => emit([...shadows, serializeShadow(DEFAULT_SHADOW, { withSpread: true })]);

  return (
    <ValueList label="Box Shadow" keys={BOX_SHADOW_KEYS} addLabel="Add box shadow" onAdd={handleAdd}>
      {shadows.length > 0 &&
        shadows.map((shadow, index) => (
          <ShadowItem
            key={index}
            value={shadow}
            withSpread
            onChange={handleChangeItem(index)}
            onRemove={handleRemoveItem(index)}
          />
        ))}
    </ValueList>
  );
};

export default BoxShadow;
