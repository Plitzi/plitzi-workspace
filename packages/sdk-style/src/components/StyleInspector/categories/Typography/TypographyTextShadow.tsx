import { useCallback } from 'react';

import ShadowItem from '../../components/ShadowItem';
import ValueList from '../../components/ValueList';
import { splitByCommaOutsideParens } from '../../cssValues';
import { DEFAULT_SHADOW, serializeShadow } from '../../shadowValue';

import type { StyleCategory, StyleValue } from '@plitzi/sdk-shared';

export type TypographyTextShadowProps = {
  value?: StyleValue;
  onChange?: (value: StyleValue | Record<StyleCategory, StyleValue> | boolean) => void;
};

const TEXT_SHADOW_KEYS: StyleCategory[] = ['text-shadow'];

const TypographyTextShadow = ({ value, onChange }: TypographyTextShadowProps) => {
  // Split outside parentheses: the comma inside `rgba(0, 0, 0, .5)` does not start another shadow.
  const shadows = typeof value === 'string' && value !== '' ? splitByCommaOutsideParens(value).map(s => s.trim()) : [];

  const emit = useCallback((next: string[]) => onChange?.(next.length > 0 ? next.join(', ') : ''), [onChange]);

  const handleRemoveItem = (index: number) => () => emit(shadows.filter((_, i) => i !== index));

  const handleChangeItem = (index: number) => (item: string) => {
    if (item !== shadows[index]) {
      emit(shadows.map((shadow, i) => (i === index ? item : shadow)));
    }
  };

  const handleAdd = () =>
    emit([...shadows, serializeShadow({ ...DEFAULT_SHADOW, y: '1px', blur: '2px' }, { withSpread: false })]);

  return (
    <ValueList label="Text Shadow" keys={TEXT_SHADOW_KEYS} addLabel="Add text shadow" onAdd={handleAdd}>
      {shadows.length > 0 &&
        shadows.map((shadow, index) => (
          <ShadowItem
            key={index}
            value={shadow}
            withSpread={false}
            onChange={handleChangeItem(index)}
            onRemove={handleRemoveItem(index)}
          />
        ))}
    </ValueList>
  );
};

export default TypographyTextShadow;
