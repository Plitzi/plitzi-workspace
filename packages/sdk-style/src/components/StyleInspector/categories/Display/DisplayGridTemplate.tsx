import { useCallback, useMemo } from 'react';

import {
  GRID_AUTO_COLUMNS,
  GRID_AUTO_FLOW,
  GRID_AUTO_ROWS,
  GRID_TEMPLATE_AREAS,
  GRID_TEMPLATE_COLUMNS,
  GRID_TEMPLATE_ROWS
} from '@plitzi/sdk-shared/style/styleConstants';

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

const keyValuesDirection: StyleCategory[] = [GRID_AUTO_FLOW];
const keyValueTemplate: StyleCategory[] = [GRID_TEMPLATE_COLUMNS, GRID_TEMPLATE_ROWS];
const keyValueAuto: StyleCategory[] = [GRID_AUTO_COLUMNS, GRID_AUTO_ROWS];

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
      onChange?.(GRID_TEMPLATE_AREAS, itemValue as StyleValue),
    [onChange]
  );

  const handleChangeTemplateRow = useCallback(
    (itemValue: StyleValue | Record<StyleCategory, StyleValue> | boolean) =>
      onChange?.(GRID_TEMPLATE_ROWS, itemValue as StyleValue),
    [onChange]
  );

  const handleChangeTemplateColumn = useCallback(
    (itemValue: StyleValue | Record<StyleCategory, StyleValue> | boolean) =>
      onChange?.(GRID_TEMPLATE_COLUMNS, itemValue as StyleValue),
    [onChange]
  );

  const handleChangeAutoRow = useCallback(
    (itemValue: StyleValue | Record<StyleCategory, StyleValue> | boolean) =>
      onChange?.(GRID_AUTO_ROWS, itemValue as StyleValue),
    [onChange]
  );

  const handleChangeAutoColumn = useCallback(
    (itemValue: StyleValue | Record<StyleCategory, StyleValue> | boolean) =>
      onChange?.(GRID_AUTO_COLUMNS, itemValue as StyleValue),
    [onChange]
  );

  const handleChangeAutoFlow = useCallback(
    (itemValue: StyleValue | Record<StyleCategory, StyleValue> | boolean) =>
      onChange?.(GRID_AUTO_FLOW, itemValue as StyleValue),
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
          keys={[GRID_TEMPLATE_AREAS]}
          label="Area"
          value={templateAreas}
          onChange={handleChangeTemplateArea}
          type="metric"
        />
        <CategoryOption
          keys={[GRID_TEMPLATE_ROWS]}
          label="Row"
          value={templateRows}
          onChange={handleChangeTemplateRow}
          type="input"
        />
        <CategoryOption
          keys={[GRID_TEMPLATE_COLUMNS]}
          label="Column"
          value={templateColumns}
          onChange={handleChangeTemplateColumn}
          type="input"
        />
      </CategorySection>
      <CategorySection label="Default" keys={keyValueAuto}>
        <CategoryOption
          keys={[GRID_AUTO_ROWS]}
          label="Row"
          value={templateAutoRows}
          onChange={handleChangeAutoRow}
          type="metric"
        />
        <CategoryOption
          keys={[GRID_AUTO_COLUMNS]}
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
