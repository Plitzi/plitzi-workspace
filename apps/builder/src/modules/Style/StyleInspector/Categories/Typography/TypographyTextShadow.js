// Packages
import React from 'react';
import noop from 'lodash/noop';

// Monorepo
import { TEXT_SHADOW } from '@plitzi/sdk-shared/style/styleConstants';

// Relatives
import InspectorLabel from '../../InspectorLabel';
import TypographyTextShadowItem from './TypographyTextShadowItem';

/**
 * @param {{
 *   value: string;
 *   onChange?: (type: string, value: string) => void;
 * }} props
 * @returns {React.ReactElement}
 */
const TypographyTextShadow = props => {
  const { onChange = noop } = props;
  let { value } = props;
  if (value !== '') {
    value = value.split(',');
  } else {
    value = [];
  }

  const handleClickRemoveItem = index => e => {
    e.stopPropagation();
    e.preventDefault();
    value.splice(index, 1);
    if (value.length > 0) {
      onChange({ type: TEXT_SHADOW, value: value.join(',') });
    } else {
      onChange({ type: TEXT_SHADOW, value: '' });
    }
  };

  const handleChangeItem = index => shadowItemValue => {
    value[index] = shadowItemValue;
    onChange({ type: TEXT_SHADOW, value: value.join(',') });
  };

  const handleClickAddItem = () => {
    value.push('2px 2px 5px black');
    onChange({ type: TEXT_SHADOW, value: value.join(',') });
  };

  return (
    <div className="w-full">
      <div className="w-full flex justify-between">
        <InspectorLabel keyValue={TEXT_SHADOW}>Text Shadow</InspectorLabel>
        <button type="button" onClick={handleClickAddItem}>
          <i className="fas fa-plus" />
        </button>
      </div>
      {value.length > 0 && (
        <div className="mt-1">
          {value.map((textShadow, index) => (
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
