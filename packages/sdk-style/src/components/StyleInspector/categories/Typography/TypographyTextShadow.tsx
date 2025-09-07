import { useCallback } from 'react';

import TypographyTextShadowItem from './TypographyTextShadowItem';
import CategorySection from '../../components/CategorySection';
import InspectorLabel from '../../components/InspectorLabel';

import type { StyleCategory, StyleValue } from '@plitzi/sdk-shared';
import type { MouseEvent } from 'react';

export type TypographyTextShadowProps = {
  value?: StyleValue;
  onChange?: (value: StyleValue | Record<StyleCategory, StyleValue> | boolean) => void;
};

const TypographyTextShadow = ({ value, onChange }: TypographyTextShadowProps) => {
  const handleClickRemoveItem = useCallback(
    (index: number) => (e: MouseEvent) => {
      e.stopPropagation();
      e.preventDefault();
      const valueParts = (value as string).split(',').toSpliced(index, 1);
      onChange?.(valueParts.length > 0 ? valueParts.join(',') : '');
    },
    [onChange, value]
  );

  const handleChangeItem = useCallback(
    (index: number) => (shadowItemValue: string) => {
      const valueParts = (value as string).split(',');
      valueParts[index] = shadowItemValue;
      onChange?.(valueParts.join(','));
    },
    [onChange, value]
  );

  const handleClickAddItem = useCallback(() => {
    const valueParts = value === '' ? [] : (value as string).split(',');
    valueParts.push('2px 2px 5px black');
    onChange?.(valueParts.join(','));
  }, [onChange, value]);

  let valueParts: string[] = [];
  if (value !== '') {
    valueParts = (value as string).split(',');
  }

  return (
    <CategorySection direction="column">
      <div className="flex w-full justify-between">
        <InspectorLabel keyValue={['text-shadow']}>Text Shadow</InspectorLabel>
        <button className="cursor-pointer" type="button" onClick={handleClickAddItem}>
          <i className="fas fa-plus" />
        </button>
      </div>
      {valueParts.length > 0 && (
        <div className="mt-1">
          {valueParts.map((textShadow, index) => (
            <TypographyTextShadowItem
              key={index}
              value={textShadow}
              onChange={handleChangeItem(index)}
              onRemove={handleClickRemoveItem(index)}
            />
          ))}
        </div>
      )}
    </CategorySection>
  );
};

export default TypographyTextShadow;
