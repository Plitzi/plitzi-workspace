// Packages
import React, { useCallback, useMemo } from 'react';
import noop from 'lodash/noop';

// Monorepo
import { TEXT_TRANSFORM, DIRECTION } from '@plitzi/sdk-style/StyleConstants';

// Alias
import Icons from '@pcomponents/Icons';

// Relatives
import GroupButtons from '../../../components/GroupButtons';

/**
 * @param {{
 *   transform: string;
 *   direction: string;
 *   onChange?: (type: string, value: string) => void;
 * }} props
 * @returns {React.ReactElement}
 */
const TypographyTransform = props => {
  const { transform, direction, onChange = noop } = props;

  const handleChange = useCallback(itemValue => onChange(itemValue.type, itemValue.value), [onChange]);

  const itemsTransform = useMemo(
    () => [
      {
        value: { value: 'none', type: TEXT_TRANSFORM },
        children: <Icons width={16} height={16} type="XMark" />,
        description: 'None',
        active: transform === 'none'
      },
      {
        value: { value: 'uppercase', type: TEXT_TRANSFORM },
        children: <Icons width={16} height={16} type="TextTransformCapitalize" />,
        description: 'All Caps',
        active: transform === 'uppercase'
      },
      {
        value: { value: 'capitalize', type: TEXT_TRANSFORM },
        children: <Icons width={16} height={16} type="TextTransformSentence" />,
        description: 'Capitalize Every Word',
        active: transform === 'capitalize'
      },
      {
        value: { value: 'lowercase', type: TEXT_TRANSFORM },
        children: <Icons width={16} height={16} type="TextTransformLowercase" />,
        description: 'Lower Case',
        active: transform === 'lowercase'
      }
    ],
    [transform]
  );

  const itemsDirection = useMemo(
    () => [
      {
        value: { value: 'ltr', type: DIRECTION },
        children: <Icons width={16} height={16} type="TextDirectionLtr" />,
        description: 'Left To Right',
        active: direction === 'ltr'
      },
      {
        value: { value: 'rtl', type: DIRECTION },
        children: <Icons width={16} height={16} type="TextDirectionRtl" />,
        description: 'Right To Left',
        active: direction === 'rtl'
      }
    ],
    [direction]
  );

  return (
    <>
      <GroupButtons
        className="w-full"
        classNameContainer="w-[180px]"
        items={itemsTransform}
        label="Capitalize"
        keyValue={TEXT_TRANSFORM}
        onChange={handleChange}
      />
      <GroupButtons
        className="w-full"
        classNameContainer="w-[180px]"
        items={itemsDirection}
        label="Direction"
        keyValue={DIRECTION}
        onChange={handleChange}
      />
    </>
  );
};

export default TypographyTransform;
