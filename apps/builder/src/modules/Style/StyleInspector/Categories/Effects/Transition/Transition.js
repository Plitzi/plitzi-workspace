// Packages
import React from 'react';
import noop from 'lodash/noop';

// Monorepo
import { TRANSITION } from '@plitzi/sdk-shared/style/StyleConstants';

// Alias
import InspectorButton from '@pmodules/Style/components/InspectorButton';

// Relatives
import TransitionItem from './TransitionItem';
import InspectorLabel from '../../../InspectorLabel';

/**
 * @param {{
 *   partialValue: string;
 *   onChange?: (type: string, value: string) => void;
 * }} props
 * @returns {React.ReactElement}
 */
const Transition = props => {
  const { onChange = noop } = props;
  let { value } = props;
  if (value && value !== '') {
    value = value.split(/,(?![^()]*\))/gim);
  } else {
    value = [];
  }

  const handleClickRemoveItem = index => e => {
    e.stopPropagation();
    e.preventDefault();
    value.splice(index, 1);
    if (value.length > 0) {
      onChange({ type: TRANSITION, value: value.join(',') });
    } else {
      onChange({ type: TRANSITION, value: undefined });
    }
  };

  const handleChangeItem = index => transitionItemValue => {
    if (transitionItemValue !== value[index]) {
      value[index] = transitionItemValue;
      onChange({ type: TRANSITION, value: value.join(',') });
    }
  };

  const handleClickAddItem = () => {
    if (value && value.length > 0) {
      onChange({ type: TRANSITION, value: `${value},opacity 200ms ease 0ms` });
    } else {
      onChange({ type: TRANSITION, value: 'opacity 200ms ease 0ms' });
    }
  };

  return (
    <>
      <div className="flex justify-between">
        <InspectorLabel keyValue={TRANSITION}>Transitions</InspectorLabel>
        <InspectorButton onClick={handleClickAddItem}>
          <i className="fas fa-plus" />
        </InspectorButton>
      </div>
      {value && value.length > 0 && (
        <div className="flex flex-col">
          {value.map((transition, index) => (
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
