// Packages
import React from 'react';
import PropTypes from 'prop-types';

// Relatives
import StyleInspector from '../../StyleInspector/StyleInspector';

const ManagerModeBasic = props => {
  const { selected } = props;

  return (
    <div className="flex flex-col grow basis-0 overflow-auto">
      {selected && (
        <StyleInspector
          mode="manager"
          selector={selected}
          styleSelectors={{ base: selected }}
          allowStyleSelector={false}
        />
      )}
      {!selected && (
        <div className="m-3 p-3 border-2 border-dashed border-gray-300 rounded text-center select-none">
          No selector or element selected. Click on one to select it.
        </div>
      )}
    </div>
  );
};

ManagerModeBasic.propTypes = {
  selected: PropTypes.string
};

export default ManagerModeBasic;
