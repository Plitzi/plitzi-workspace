// Packages
import React from 'react';
import noop from 'lodash/noop';

// Monorepo
import { TRANSFORM } from '@plitzi/sdk-shared/style/styleConstants';

// Alias
import InspectorButton from '@pmodules/Style/components/InspectorButton';

// Relatives
import TransformationItem from './TransformItem';
import InspectorLabel from '../../../InspectorLabel';

/**
 * @param {{
 *   value: string;
 *   onChange?: (type: string, value: string) => void;
 * }} props
 * @returns {React.ReactElement}
 */
const Transform = props => {
  const { onChange = noop } = props;
  let { value } = props;
  if (value && value !== '') {
    value = value.match(/((translate3d|scale3d|skew)\([0-9a-z-, .%]+\))|(rotateX.*rotateZ\([0-9a-z%]+\))/gim);
  } else {
    value = [];
  }

  const handleClickRemoveItem = index => e => {
    e.stopPropagation();
    e.preventDefault();
    value.splice(index, 1);
    if (value.length > 0) {
      onChange({ type: TRANSFORM, value: value.join(' ') });
    } else {
      onChange({ type: TRANSFORM, value: undefined });
    }
  };

  const handleChangeItem = index => transformItemValue => {
    if (transformItemValue !== value[index]) {
      value[index] = transformItemValue;
      onChange({ type: TRANSFORM, value: value.join(' ') });
    }
  };

  const handleClickAddItem = () => {
    if (value) {
      onChange({ type: TRANSFORM, value: `${value} translate3d(0px, 0px, 0px)` });
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
      {value && value.length > 0 && (
        <div className="flex flex-col">
          {value.map((transform, index) => (
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
