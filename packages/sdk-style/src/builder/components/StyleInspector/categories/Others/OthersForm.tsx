import CategoryOption from '../../components/CategoryOption';
import CategorySection from '../../components/CategorySection';

import type { StyleCategory, StyleValue } from '@plitzi/sdk-shared';

export type OthersFormProps = {
  accentColor?: StyleValue;
  caretColor?: StyleValue;
  colorScheme?: StyleValue;
  onChange?: (category: StyleCategory) => (value: StyleValue | Record<StyleCategory, StyleValue> | boolean) => void;
};

const OthersForm = ({ accentColor, caretColor, colorScheme, onChange }: OthersFormProps) => {
  return (
    <>
      <CategorySection label="">
        <CategoryOption
          keys={['accent-color']}
          label="Accent"
          type="color"
          value={accentColor}
          onChange={onChange?.('accent-color')}
        />
        <CategoryOption
          keys={['caret-color']}
          label="Caret"
          type="color"
          value={caretColor}
          onChange={onChange?.('caret-color')}
        />
      </CategorySection>
      <CategorySection label="Color Scheme" keys={['color-scheme']}>
        <CategoryOption value={colorScheme} onChange={onChange?.('color-scheme')} type="select">
          <option value="normal">Normal</option>
          <option value="light">Light</option>
          <option value="dark">Dark</option>
          <option value="light dark">Light Dark</option>
        </CategoryOption>
      </CategorySection>
    </>
  );
};

export default OthersForm;
