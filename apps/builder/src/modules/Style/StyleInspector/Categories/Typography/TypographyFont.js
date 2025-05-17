// Packages
import React, { useCallback, useMemo } from 'react';
import noop from 'lodash/noop';

// Monorepo
import { FONT_FAMILY } from '@plitzi/sdk-shared/style/styleConstants';

// Relatives
import { defaultFonts } from './TypographyConstants';
import GroupButtons from '../../../components/GroupButtons';

const fontsDefault = [];

/**
 * @param {{
 *   partialValue: string;
 *   fonts?: { name: string }[];
 *   onChange?: (value: { type: string; value: string }) => void;
 * }} props
 * @returns {React.ReactElement}
 */
const TypographyFont = props => {
  const { partialValue, onChange = noop } = props;
  let { fonts = fontsDefault } = props;
  fonts = [...fonts, ...defaultFonts];

  const handleChange = useCallback(itemValue => onChange(itemValue), [onChange]);

  const items = useMemo(
    () => [
      {
        type: 'select',
        value: partialValue,
        extraValue: { type: FONT_FAMILY },
        children:
          fonts &&
          fonts.map(font => (
            <option key={font.name} style={{ fontFamily: font.name }} value={font.name}>
              {font.name}
            </option>
          ))
      }
    ],
    [partialValue, fonts]
  );

  return (
    <GroupButtons
      className="w-full"
      classNameContainer="w-[180px]"
      keyValue={FONT_FAMILY}
      items={items}
      label="F. Family"
      onChange={handleChange}
    />
  );
};

export default TypographyFont;
