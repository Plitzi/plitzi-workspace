// Packages
import React, { useCallback, useMemo } from 'react';
import noop from 'lodash/noop';

// Monorepo
import { TOP, BOTTOM, LEFT, RIGHT } from '@plitzi/sdk-style/StyleConstants';

// Alias
import Icons from '@pcomponents/Icons';

// Relatives
import GroupButtons from '../../../components/GroupButtons';

/**
 * @param {{
 *   value: object;
 *   onChange?: (value: { type: string; value: string }) => void;
 * }} props
 * @returns {React.ReactElement}
 */
const PositionAdvancedButtons = props => {
  const { value, onChange = noop } = props;
  const { [TOP]: top, [BOTTOM]: bottom, [LEFT]: left, [RIGHT]: right } = value;

  const handleChange = useCallback(itemValue => onChange(itemValue), [onChange]);

  const items = useMemo(
    () => [
      {
        value: { value: { top: '0%', left: '0%', bottom: 'auto', right: 'auto' }, type: 'position-path' },
        children: <Icons width={16} height={16} type="PositionTopleft" />,
        description: 'Top Left',
        active: top === '0%' && left === '0%' && bottom === 'auto' && right === 'auto'
      },
      {
        value: { value: { top: '0%', left: 'auto', bottom: 'auto', right: '0%' }, type: 'position-path' },
        children: <Icons width={16} height={16} type="PositionTopright" />,
        description: 'Top Right',
        active: top === '0%' && left === 'auto' && bottom === 'auto' && right === '0%'
      },
      {
        value: { value: { top: 'auto', left: '0%', bottom: '0%', right: 'auto' }, type: 'position-path' },
        children: <Icons width={16} height={16} type="PositionBottomLeft" />,
        description: 'Bottom Left',
        active: top === 'auto' && left === '0%' && bottom === '0%' && right === 'auto'
      },
      {
        value: { value: { top: 'auto', left: 'auto', bottom: '0%', right: '0%' }, type: 'position-path' },
        children: <Icons width={16} height={16} type="PositionBottomRight" />,
        description: 'Bottom Right',
        active: top === '0%' && left === '0%' && bottom === '0%' && right === 'auto'
      },
      {
        value: { value: { top: '0%', left: '0%', bottom: '0%', right: 'auto' }, type: 'position-path' },
        children: <Icons width={16} height={16} type="PositionLeft" />,
        description: 'Left',
        active: top === '0%' && left === '0%' && bottom === '0%' && right === 'auto'
      },
      {
        value: { value: { top: '0%', left: 'auto', bottom: '0%', right: '0%' }, type: 'position-path' },
        children: <Icons width={16} height={16} type="PositionRight" />,
        description: 'Right',
        active: top === '0%' && left === 'auto' && bottom === '0%' && right === '0%'
      },
      {
        value: { value: { top: 'auto', left: '0%', bottom: '0%', right: '0%' }, type: 'position-path' },
        children: <Icons width={16} height={16} type="PositionBottom" />,
        description: 'Bottom',
        active: top === 'auto' && left === '0%' && bottom === '0%' && right === '0%'
      },
      {
        value: { value: { top: '0%', left: '0%', bottom: 'auto', right: '0%' }, type: 'position-path' },
        children: <Icons width={16} height={16} type="PositionTop" />,
        description: 'Top',
        active: top === '0%' && left === '0%' && bottom === 'auto' && right === '0%'
      },
      {
        value: { value: { top: '0%', left: '0%', bottom: '0%', right: '0%' }, type: 'position-path' },
        children: <Icons width={16} height={16} type="PositionAll" />,
        description: 'Full',
        active: top === '0%' && left === '0%' && bottom === '0%' && right === '0%'
      }
    ],
    [top, left, bottom, right]
  );

  return <GroupButtons className="w-full" fullWidth items={items} label="" onChange={handleChange} />;
};

export default PositionAdvancedButtons;
