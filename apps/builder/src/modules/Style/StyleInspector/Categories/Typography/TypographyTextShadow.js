// Packages
import React from 'react';
import noop from 'lodash/noop';

// Monorepo
import { TEXT_SHADOW } from '@plitzi/sdk-style/StyleConstants';

// Relatives
import InspectorLabel from '../../InspectorLabel';
import TypographyTextShadowItem from './TypographyTextShadowItem';

/**
 * @param {{
 *   partialValue: string;
 *   onChange?: (type: string, value: string) => void;
 * }} props
 * @returns {React.ReactElement}
 */
const TypographyTextShadow = props => {
  const { onChange = noop } = props;
  let { partialValue } = props;
  if (partialValue !== '') {
    partialValue = partialValue.split(',');
  } else {
    partialValue = [];
  }

  const handleClickRemoveItem = index => e => {
    e.stopPropagation();
    e.preventDefault();
    partialValue.splice(index, 1);
    if (partialValue.length > 0) {
      onChange({ type: TEXT_SHADOW, value: partialValue.join(',') });
    } else {
      onChange({ type: TEXT_SHADOW, value: '' });
    }
  };

  const handleChangeItem = index => shadowItemValue => {
    partialValue[index] = shadowItemValue;
    onChange({ type: TEXT_SHADOW, value: partialValue.join(',') });
  };

  const handleClickAddItem = () => {
    partialValue.push('2px 2px 5px black');
    onChange({ type: TEXT_SHADOW, value: partialValue.join(',') });
  };

  return (
    <div className="w-full">
      <div className="w-full flex justify-between">
        <InspectorLabel keyValue={TEXT_SHADOW}>Text Shadow</InspectorLabel>
        <button type="button" onClick={handleClickAddItem}>
          <i className="fas fa-plus" />
        </button>
      </div>
      {partialValue.length > 0 && (
        <div className="mt-1">
          {partialValue.map((textShadow, index) => (
            <TypographyTextShadowItem
              key={index}
              value={textShadow}
              onChange={handleChangeItem(index)}
              onRemove={handleClickRemoveItem(index)}
            />
          ))}
        </div>
      )}
    </div>
  );
};

export default TypographyTextShadow;
