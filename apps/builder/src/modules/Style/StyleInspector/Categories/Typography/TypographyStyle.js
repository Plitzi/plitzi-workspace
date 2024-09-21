// Packages
import React, { useCallback, useMemo } from 'react';
import noop from 'lodash/noop';

// Monorepo
import { FONT_STYLE, TEXT_DECORATION } from '@plitzi/sdk-style/StyleConstants';

// Alias
import Icons from '@pcomponents/Icons';

// Relatives
import GroupButtons from '../../../components/GroupButtons';

/**
 * @param {{
 *   fontStyle: string;
 *   textDecoration: string;
 *   onChange?: (type: string, value: string) => void;
 * }} props
 * @returns {React.ReactElement}
 */
const TypographyStyle = props => {
  const { fontStyle, textDecoration, onChange = noop } = props;

  const handleChange = useCallback(itemValue => onChange(itemValue), [onChange]);

  const itemsItalicize = useMemo(
    () => [
      {
        value: { value: 'normal', type: FONT_STYLE },
        children: <Icons width={16} height={16} type="FontNormal" />,
        description: 'Normal',
        active: fontStyle === 'normal'
      },
      {
        value: { value: 'italic', type: FONT_STYLE },
        children: <Icons width={16} height={16} type="FontItalic" />,
        description: 'Italic',
        active: fontStyle === 'italic'
      }
    ],
    [fontStyle]
  );

  const itemsDecoration = useMemo(
    () => [
      {
        value: { value: 'none', type: TEXT_DECORATION },
        children: <Icons width={16} height={16} type="XMark" />,
        description: 'None',
        active: textDecoration === 'none'
      },
      {
        value: { value: 'line-through', type: TEXT_DECORATION },
        children: <Icons width={16} height={16} type="TextDecorationStrike" />,
        description: 'Strikethrough',
        active: textDecoration === 'line-through'
      },
      {
        value: { value: 'underline', type: TEXT_DECORATION },
        children: <Icons width={16} height={16} type="TextDecorationUnderline" />,
        description: 'Underline',
        active: textDecoration === 'underline'
      },
      {
        value: { value: 'overline', type: TEXT_DECORATION },
        children: <Icons width={16} height={16} type="TextDecorationOverline" />,
        description: 'Overline',
        active: textDecoration === 'overline'
      }
    ],
    [textDecoration]
  );

  return (
    <>
      <GroupButtons
        className="w-full"
        classNameContainer="w-[180px]"
        keyValue={FONT_STYLE}
        items={itemsItalicize}
        label="Italicize"
        onChange={handleChange}
      />
      <GroupButtons
        className="w-full"
        classNameContainer="w-[180px]"
        keyValue={TEXT_DECORATION}
        items={itemsDecoration}
        label="Decoration"
        onChange={handleChange}
      />
    </>
  );
};

export default TypographyStyle;
