// Packages
import React from 'react';
import PropTypes from 'prop-types';
import noop from 'lodash/noop';

// Alias
import InspectorButton from '@pmodules/Style/components/InspectorButton';
import { TRANSITION } from '@pmodules/Style/StyleConstants';

// Relatives
import TransitionItem from './TransitionItem';
import InspectorLabel from '../../../InspectorLabel';

const Transition = props => {
  const { onChange = noop } = props;
  let { partialValue } = props;
  if (partialValue && partialValue !== '') {
    partialValue = partialValue.split(/,(?![^()]*\))/gim);
  } else {
    partialValue = [];
  }

  const handleClickRemoveItem = index => e => {
    e.stopPropagation();
    e.preventDefault();
    partialValue.splice(index, 1);
    if (partialValue.length > 0) {
      onChange({ type: TRANSITION, value: partialValue.join(',') });
    } else {
      onChange({ type: TRANSITION, value: null });
    }
  };

  const handleChangeItem = index => transitionItemValue => {
    if (transitionItemValue !== partialValue[index]) {
      partialValue[index] = transitionItemValue;
      onChange({ type: TRANSITION, value: partialValue.join(',') });
    }
  };

  const handleClickAddItem = () => {
    if (partialValue && partialValue.length > 0) {
      onChange({ type: TRANSITION, value: `${partialValue},opacity 200ms ease 0ms` });
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
      {partialValue && partialValue.length > 0 && (
        <div className="flex flex-col">
          {partialValue.map((transition, index) => (
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

Transition.propTypes = {
  partialValue: PropTypes.string,
  onChange: PropTypes.func
};

export default Transition;
