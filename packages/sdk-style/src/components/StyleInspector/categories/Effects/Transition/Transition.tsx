import Icon from '@plitzi/plitzi-ui/Icon';
import { useCallback } from 'react';

import TransitionItem from './TransitionItem';
import InspectorLabel from '../../../components/InspectorLabel';

import type { StyleCategory, StyleValue } from '@plitzi/sdk-shared';
import type { MouseEvent } from 'react';

export type TransitionProps = {
  value?: StyleValue;
  onChange?: (value: StyleValue | Record<StyleCategory, StyleValue> | boolean) => void;
};

const Transition = ({ value, onChange }: TransitionProps) => {
  let transitions: string[] = [];
  if (value && value !== '') {
    transitions = (value as string).split(/,(?![^()]*\))/gim);
  }

  const handleClickRemoveItem = (index: number) => (e: MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    transitions.splice(index, 1);
    if (transitions.length > 0) {
      onChange?.(transitions.join(','));
    } else {
      onChange?.('');
    }
  };

  const handleChangeItem = (index: number) => (transitionItemValue: string) => {
    if (transitionItemValue !== transitions[index]) {
      transitions[index] = transitionItemValue;
      onChange?.(transitions.join(','));
    }
  };

  const handleClickAddItem = useCallback(() => {
    if (transitions.length > 0) {
      onChange?.(`${value},opacity 200ms ease 0ms`);
    } else {
      onChange?.('opacity 200ms ease 0ms');
    }
  }, [onChange, transitions.length, value]);

  return (
    <>
      <div className="flex justify-between">
        <InspectorLabel keyValue={['transition']}>Transitions</InspectorLabel>
        <Icon className="cursor-pointer" icon="fas fa-plus" onClick={handleClickAddItem} />
      </div>
      {transitions.length > 0 && (
        <div className="flex flex-col gap-2">
          {transitions.map((transition, index) => (
            <TransitionItem
              key={index}
              value={transition}
              onChange={handleChangeItem(index)}
              onRemove={handleClickRemoveItem(index)}
            />
          ))}
        </div>
      )}
    </>
  );
};

export default Transition;
