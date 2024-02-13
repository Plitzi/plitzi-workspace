// Packages
import React, { forwardRef } from 'react';
import PropTypes from 'prop-types';

const BuilderCollaboratorHeaderUser = props => {
  const { forwardRef, color = '#000', firstName = '', surName = '' } = props;

  return (
    <div
      ref={forwardRef}
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

BuilderCollaboratorHeaderUser.propTypes = {
  forwardRef: PropTypes.object,
  color: PropTypes.string,
  firstName: PropTypes.string,
  surName: PropTypes.string
};

export default forwardRef((props, ref) => <BuilderCollaboratorHeaderUser forwardRef={ref} {...props} />);
