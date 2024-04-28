// Packages
import React from 'react';

/**
 * @param {{
 *   ref: React.RefObject<HTMLDivElement>;
 *   color: string;
 *   firstName: string;
 *   surName: string;
 * }} props
 * @returns {React.ReactElement}
 */
const BuilderCollaboratorHeaderUser = props => {
  const { ref, color = '#000', firstName = '', surName = '' } = props;

  return (
    <div
      ref={ref}
      className="cursor-pointer h-8 w-8 text-white rounded-full font-bold text-[9px] flex items-center select-none justify-center border-2 text-xs"
      style={{ borderColor: color }}
      title={`${firstName} ${surName}`}
    >
      <div
        className="bg-blue-400 w-full h-[calc(100%-4px)] rounded-full uppercase flex items-center justify-center m-0.5"
        style={{ backgroundColor: color }}
      >
        {firstName && firstName[0]}
        {surName && surName[0]}
      </div>
    </div>
  );
};

export default BuilderCollaboratorHeaderUser;
