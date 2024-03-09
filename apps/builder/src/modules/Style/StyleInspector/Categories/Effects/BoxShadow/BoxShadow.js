// Packages
import React, { useCallback } from 'react';
import PropTypes from 'prop-types';
import noop from 'lodash/noop';

// Alias
import InspectorButton from '@pmodules/Style/components/InspectorButton';
import { BOX_SHADOW } from '@pmodules/Style/StyleConstants';

// Relatives
import BoxShadowItem from './BoxShadowItem';
import InspectorLabel from '../../../InspectorLabel';

const BoxShadow = props => {
  const { partialValue = '', onChange = noop } = props;
  const boxShadowRegex = /,(?![^(]*\))/gim;
  let boxShadows = partialValue;
  if (boxShadows && boxShadows !== '') {
    boxShadows = boxShadows.split(boxShadowRegex);
  } else {
    boxShadows = [];
  }

  const handleClickRemoveItem = index => e => {
    e.stopPropagation();
    e.preventDefault();
    boxShadows.splice(index, 1);
    if (boxShadows.length > 0) {
      onChange({ type: BOX_SHADOW, value: boxShadows.join(',') });
    } else {
      onChange({ type: BOX_SHADOW, value: undefined });
    }
  };

  const handleChangeItem = index => shadowItemValue => {
    if (shadowItemValue !== boxShadows[index]) {
      boxShadows[index] = shadowItemValue;
      onChange({ type: BOX_SHADOW, value: boxShadows.join(',') });
    }
  };

  const handleClickAddItem = useCallback(() => {
    if (partialValue) {
      onChange({ type: BOX_SHADOW, value: `${partialValue},1px 1px 3px 1px black` });
    } else {
      onChange({ type: BOX_SHADOW, value: '1px 1px 3px 1px black' });
    }
  }, [partialValue, onChange]);

  return (
    <>
      <div className="flex justify-between items-center">
        <InspectorLabel keyValue={BOX_SHADOW}>Box Shadow</InspectorLabel>
        <InspectorButton onClick={handleClickAddItem}>
          <i className="fas fa-plus" />
        </InspectorButton>
      </div>
      {boxShadows && boxShadows.length > 0 && (
        <div className="flex flex-col">
          {boxShadows.map((boxShadow, index) => (
            <BoxShadowItem
              key={index}
              value={boxShadow.trim()}
              onChange={handleChangeItem(index)}
              onRemove={handleClickRemoveItem(index)}
            />
          ))}
        </div>
      )}
    </>
  );
};

BoxShadow.propTypes = {
  partialValue: PropTypes.string,
  onChange: PropTypes.func
};

export default BoxShadow;
