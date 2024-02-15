// Packages
import React from 'react';
import PropTypes from 'prop-types';
import noop from 'lodash/noop';

// Alias
import InspectorButton from '@pmodules/Style/components/InspectorButton';
import { TRANSFORM } from '@pmodules/Style/StyleConstants';

// Relatives
import TransformationItem from './TransformItem';
import InspectorLabel from '../../../InspectorLabel';

const Transform = props => {
  const { onChange = noop } = props;
  let { partialValue } = props;
  if (partialValue && partialValue !== '') {
    partialValue = partialValue.match(
      /((translate3d|scale3d|skew)\([0-9a-z-, .%]+\))|(rotateX.*rotateZ\([0-9a-z%]+\))/gim
    );
  } else {
    partialValue = [];
  }

  const handleClickRemoveItem = index => e => {
    e.stopPropagation();
    e.preventDefault();
    partialValue.splice(index, 1);
    if (partialValue.length > 0) {
      onChange({ type: TRANSFORM, value: partialValue.join(' ') });
    } else {
      onChange({ type: TRANSFORM, value: null });
    }
  };

  const handleChangeItem = index => transformItemValue => {
    if (transformItemValue !== partialValue[index]) {
      partialValue[index] = transformItemValue;
      onChange({ type: TRANSFORM, value: partialValue.join(' ') });
    }
  };

  const handleClickAddItem = () => {
    if (partialValue) {
      onChange({ type: TRANSFORM, value: `${partialValue} translate3d(0px, 0px, 0px)` });
    } else {
      onChange({ type: TRANSFORM, value: 'translate3d(0px, 0px, 0px)' });
    }
  };

  return (
    <>
      <div className="flex justify-between">
        <InspectorLabel keyValue={TRANSFORM}>2D & 3D Transforms</InspectorLabel>
        <InspectorButton onClick={handleClickAddItem}>
          <i className="fas fa-plus" />
        </InspectorButton>
      </div>
      {partialValue && partialValue.length > 0 && (
        <div className="flex flex-col">
          {partialValue.map((transform, index) => (
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

Transform.propTypes = {
  className: PropTypes.string,
  partialValue: PropTypes.string,
  onChange: PropTypes.func
};

export default Transform;
