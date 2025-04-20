import Icon from '@plitzi/plitzi-ui/Icon';
import { useCallback } from 'react';

import BoxShadowItem from './BoxShadowItem';
import InspectorLabel from '../../../components/InspectorLabel';

import type { StyleCategory, StyleValue } from '@plitzi/sdk-shared';
import type { MouseEvent } from 'react';

export type BoxShadowProps = {
  value?: StyleValue;
  onChange?: (value: StyleValue | Record<StyleCategory, StyleValue> | boolean) => void;
};

const BoxShadow = ({ value = '', onChange }: BoxShadowProps) => {
  const boxShadowRegex = /,(?![^(]*\))/gim;
  let boxShadows: string[] = [];
  if (value && value !== '') {
    boxShadows = (value as string).split(boxShadowRegex);
  }

  const handleClickRemoveItem = (index: number) => (e: MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    boxShadows.splice(index, 1);
    if (boxShadows.length > 0) {
      onChange?.(boxShadows.join(','));
    } else {
      onChange?.('');
    }
  };

  const handleChangeItem = (index: number) => (shadowItemValue: string) => {
    if (shadowItemValue !== boxShadows[index]) {
      boxShadows[index] = shadowItemValue;
      onChange?.(boxShadows.join(','));
    }
  };

  const handleClickAddItem = useCallback(() => {
    if (value) {
      onChange?.(`${value},1px 1px 3px 1px black`);
    } else {
      onChange?.('1px 1px 3px 1px black');
    }
  }, [value, onChange]);

  return (
    <>
      <div className="flex justify-between items-center">
        <InspectorLabel keyValue={['box-shadow']}>Box Shadow</InspectorLabel>
        <Icon className="cursor-pointer" icon="fas fa-plus" onClick={handleClickAddItem} />
      </div>
      {boxShadows.length > 0 && (
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

export default BoxShadow;
