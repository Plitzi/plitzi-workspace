import { useCallback } from 'react';

import { DEFAULT_TRANSITION, serializeTransition } from './helpers';
import TransitionItem from './TransitionItem';
import ValueList from '../../../components/ValueList';
import { splitByCommaOutsideParens } from '../../../cssValues';

import type { StyleCategory, StyleValue } from '@plitzi/sdk-shared';

export type TransitionProps = {
  value?: StyleValue;
  onChange?: (value: StyleValue | Record<StyleCategory, StyleValue> | boolean) => void;
};

const TRANSITION_KEYS: StyleCategory[] = ['transition'];

const Transition = ({ value, onChange }: TransitionProps) => {
  // Split outside parentheses: `cubic-bezier(.4, 0, .2, 1)` is one easing, not four transitions.
  const transitions =
    typeof value === 'string' && value !== '' ? splitByCommaOutsideParens(value).map(t => t.trim()) : [];

  const emit = useCallback((next: string[]) => onChange?.(next.length > 0 ? next.join(', ') : ''), [onChange]);

  const handleRemoveItem = (index: number) => () => emit(transitions.filter((_, i) => i !== index));

  const handleChangeItem = (index: number) => (item: string) => {
    if (item !== transitions[index]) {
      emit(transitions.map((transition, i) => (i === index ? item : transition)));
    }
  };

  const handleAdd = () => emit([...transitions, serializeTransition(DEFAULT_TRANSITION)]);

  return (
    <ValueList label="Transitions" keys={TRANSITION_KEYS} addLabel="Add transition" onAdd={handleAdd}>
      {transitions.length > 0 &&
        transitions.map((transition, index) => (
          <TransitionItem
            key={index}
            value={transition}
            onChange={handleChangeItem(index)}
            onRemove={handleRemoveItem(index)}
          />
        ))}
    </ValueList>
  );
};

export default Transition;
