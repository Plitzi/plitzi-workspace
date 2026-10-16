import { useCallback, useMemo } from 'react';

import CategoryOption from '../../components/CategoryOption';
import CategorySection from '../../components/CategorySection';

import type { StyleCategory, StyleValue } from '@plitzi/sdk-shared';

export type DisplayGridTemplateProps = {
  templateAreas?: StyleValue;
  templateColumns?: StyleValue;
  templateRows?: StyleValue;
  templateAutoFlow?: StyleValue;
  templateAutoRows?: StyleValue;
  templateAutoColumns?: StyleValue;
  onChange?: (type: StyleCategory, value: StyleValue) => void;
};

const keyValuesDirection: StyleCategory[] = ['grid-auto-flow'];
const keyValueTemplate: StyleCategory[] = ['grid-template-columns', 'grid-template-rows'];
const keyValueAuto: StyleCategory[] = ['grid-auto-columns', 'grid-auto-rows'];

const DisplayGridTemplate = ({
  templateAreas = 'none',
  templateColumns = 'none',
  templateRows = 'none',
  templateAutoFlow = 'row',
  templateAutoRows = 'none',
  templateAutoColumns = 'none',
  onChange
}: DisplayGridTemplateProps) => {
  const handleChangeTemplateArea = useCallback(
    (itemValue: StyleValue | Record<StyleCategory, StyleValue> | boolean) =>
      onChange?.('grid-template-areas', itemValue as StyleValue),
    [onChange]
  );

  const handleChangeTemplateRow = useCallback(
    (itemValue: StyleValue | Record<StyleCategory, StyleValue> | boolean) =>
      onChange?.('grid-template-rows', itemValue as StyleValue),
    [onChange]
  );

  const handleChangeTemplateColumn = useCallback(
    (itemValue: StyleValue | Record<StyleCategory, StyleValue> | boolean) =>
      onChange?.('grid-template-columns', itemValue as StyleValue),
    [onChange]
  );

  const handleChangeAutoRow = useCallback(
    (itemValue: StyleValue | Record<StyleCategory, StyleValue> | boolean) =>
      onChange?.('grid-auto-rows', itemValue as StyleValue),
    [onChange]
  );

  const handleChangeAutoColumn = useCallback(
    (itemValue: StyleValue | Record<StyleCategory, StyleValue> | boolean) =>
      onChange?.('grid-auto-columns', itemValue as StyleValue),
    [onChange]
  );

  const handleChangeAutoFlow = useCallback(
    (itemValue: StyleValue | Record<StyleCategory, StyleValue> | boolean) =>
      onChange?.('grid-auto-flow', itemValue as StyleValue),
    [onChange]
  );

  const itemsDirection = useMemo(
    () => [
      {
        value: 'row',
        icon: <div className="px-1 text-xs whitespace-nowrap select-none">Row</div>,
        description: '',
        active: templateAutoFlow === 'row',
        size: 'custom' as const
      },
      {
        value: 'column',
        icon: <div className="px-1 text-xs select-none">Column</div>,
        description: '',
        active: templateAutoFlow === 'column',
        size: 'custom' as const
      }
    ],
    [templateAutoFlow]
  );

  return (
    <>
      <CategorySection label="Direction" keys={keyValuesDirection}>
        <CategoryOption type="iconGroup" items={itemsDirection} onChange={handleChangeAutoFlow} />
      </CategorySection>
      <CategorySection label="Template" keys={keyValueTemplate}>
        <CategoryOption
          keys={['grid-template-areas']}
          label="Area"
          value={templateAreas}
          onChange={handleChangeTemplateArea}
          type="metric"
        />
        <CategoryOption
          keys={['grid-template-rows']}
          label="Row"
          value={templateRows}
          onChange={handleChangeTemplateRow}
          type="input"
        />
        <CategoryOption
          keys={['grid-template-columns']}
          label="Column"
          value={templateColumns}
          onChange={handleChangeTemplateColumn}
          type="input"
        />
      </CategorySection>
      <CategorySection label="Default" keys={keyValueAuto}>
        <CategoryOption
          keys={['grid-auto-rows']}
          label="Row"
          value={templateAutoRows}
          onChange={handleChangeAutoRow}
          type="metric"
        />
        <CategoryOption
          keys={['grid-auto-columns']}
          label="Column"
          value={templateAutoColumns}
          onChange={handleChangeAutoColumn}
          type="metric"
        />
      </CategorySection>
    </>
  );
};

export default DisplayGridTemplate;
