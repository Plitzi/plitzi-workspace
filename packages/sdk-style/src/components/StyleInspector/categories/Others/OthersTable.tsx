import CategoryOption from '../../components/CategoryOption';
import CategorySection from '../../components/CategorySection';

import type { StyleCategory, StyleValue } from '@plitzi/sdk-shared';

export type OthersTableProps = {
  borderCollapse?: StyleValue;
  borderSpacing?: StyleValue;
  tableLayout?: StyleValue;
  onChange?: (category: StyleCategory) => (value: StyleValue | Record<StyleCategory, StyleValue> | boolean) => void;
};

const OthersTable = ({ borderCollapse, borderSpacing, tableLayout, onChange }: OthersTableProps) => {
  return (
    <>
      <CategorySection label="">
        <CategoryOption
          keys={['border-collapse']}
          label="Collapse"
          value={borderCollapse}
          onChange={onChange?.('border-collapse')}
          type="select"
        >
          <option value="separate">Separate</option>
          <option value="collapse">Collapse</option>
        </CategoryOption>
        <CategoryOption
          keys={['table-layout']}
          label="Table Layout"
          value={tableLayout}
          onChange={onChange?.('table-layout')}
          type="select"
        >
          <option value="auto">Auto</option>
          <option value="fixed">Fixed</option>
        </CategoryOption>
      </CategorySection>
      <CategorySection label="Cell Spacing" keys={['border-spacing']}>
        <CategoryOption value={borderSpacing} onChange={onChange?.('border-spacing')} type="metric" />
      </CategorySection>
    </>
  );
};

export default OthersTable;
