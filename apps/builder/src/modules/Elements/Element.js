// Packages
import React from 'react';
import Icon from '@plitzi/plitzi-ui/Icon';
import PlitziLogo from '@plitzi/plitzi-ui/icons/PlitziLogo';

// Relatives
import useDragElement from './hooks/useDragElement';

/**
 * @param {{
 *   element: {
 *     market: {
 *       icon: string;
 *       backgroundColor: string;
 *     };
 *     definition: {
 *       label: string;
 *       type: string;
 *     };
 *   };
 * }} props
 * @returns {React.ReactElement}
 */
const Element = props => {
  const {
    element: {
      market: { icon },
      definition: { label, type }
    }
  } = props;
  const { onDragStart } = useDragElement({ type });

  return (
    <div
      className="flex flex-col gap-2 items-center py-2 cursor-grabbing"
      draggable
      onDragStart={onDragStart}
      title={label}
    >
      <div className="w-9 h-9 p-1.5 flex flex-col shrink-0 items-center justify-center border border-gray-300 rounded-lg">
        {icon && typeof icon === 'string' && !icon.startsWith('http') && <Icon intent="custom" icon={icon} />}
        {icon && typeof icon === 'string' && icon.startsWith('http') && (
          <Icon intent="custom">
            <img src={icon} />
          </Icon>
        )}
        {icon && typeof icon !== 'string' && <Icon intent="custom">{icon}</Icon>}
        {!icon && (
          <Icon intent="custom">
            <PlitziLogo />
          </Icon>
        )}
      </div>
      <div className="flex w-20 items-center h-full p-1 justify-center text-center overflow-hidden">
        <div className="truncate text-xs">{label}</div>
      </div>
    </div>
  );
};

export default Element;
