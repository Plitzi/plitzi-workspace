import { useCallback } from 'react';

import { splitByCommaOutsideParens } from '../../cssValues';
import ShadowItem from '../ShadowItem';
import ValueList from '../ValueList';

import type { StyleCategory, StyleValue } from '@plitzi/sdk-shared';

export type ShadowListProps = {
  label: string;
  keys: StyleCategory[];
  addLabel: string;
  /** A box shadow has a spread; a text shadow has none. */
  withSpread: boolean;
  /** What "add" puts at the end of the list. */
  added: string;
  value?: StyleValue;
  onChange?: (value: StyleValue | Record<StyleCategory, StyleValue> | boolean) => void;
};

/** A property that holds a list of shadows, one row each — added, edited and removed in place. */
const ShadowList = ({ label, keys, addLabel, withSpread, added, value, onChange }: ShadowListProps) => {
  // Split outside parentheses: the comma inside `rgba(0, 0, 0, .5)` does not start another shadow.
  const shadows = typeof value === 'string' && value !== '' ? splitByCommaOutsideParens(value).map(s => s.trim()) : [];

  const emit = useCallback((next: string[]) => onChange?.(next.length > 0 ? next.join(', ') : ''), [onChange]);

  const handleRemoveItem = (index: number) => () => emit(shadows.filter((_, i) => i !== index));

  const handleChangeItem = (index: number) => (item: string) => {
    if (item !== shadows[index]) {
      emit(shadows.map((shadow, i) => (i === index ? item : shadow)));
    }
  };

  const handleAdd = () => emit([...shadows, added]);

  return (
    <ValueList label={label} keys={keys} addLabel={addLabel} onAdd={handleAdd}>
      {shadows.map((shadow, index) => (
        <ShadowItem
          key={index}
          value={shadow}
          withSpread={withSpread}
          onChange={handleChangeItem(index)}
          onRemove={handleRemoveItem(index)}
        />
      ))}
    </ValueList>
  );
};

export default ShadowList;
