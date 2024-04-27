// Packages
import React from 'react';

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
      market: { icon, backgroundColor },
      definition: { label, type }
    }
  } = props;
  const { onDragStart } = useDragElement({ type });

  return (
    <div
      className="w-20 h-20 flex flex-col items-center justify-between border border-gray-300 rounded overflow-hidden cursor-grabbing"
      draggable
      onDragStart={onDragStart}
      title={label}
    >
      <div className="p-1 w-full flex items-center justify-center" style={{ backgroundColor }}>
        <div className="h-8 w-8 flex shrink-0 bg-white items-center justify-center rounded-lg">
          <img className="h-7 w-7 pointer-events-none" src={icon} alt="" />
        </div>
      </div>
      <div className="flex items-center h-full p-1 justify-center w-full text-center overflow-hidden">
        <div className="truncate text-xs">{label}</div>
      </div>
    </div>
  );
};

export default Element;
