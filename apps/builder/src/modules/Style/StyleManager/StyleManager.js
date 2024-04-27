// Packages
import React, { useContext, useMemo, useState } from 'react';
import get from 'lodash/get';

// Alias
import AppContext from '@pmodules/App/AppContext';
import BuilderStyleContext from '@pmodules/Builder/contexts/BuilderStyleContext';
import BuilderSchemaContext from '@pmodules/Builder/contexts/BuilderSchemaContext';

// Relatives
import ManagerModeBasic from './modes/ManagerModeBasic';
import ManagerSelector from './ManagerSelector';

/**
 * @param {{}} props
 * @returns {React.ReactElement}
 */
const StyleManager = () => {
  const [selected, setSelected] = useState();
  const { style } = useContext(BuilderStyleContext);
  const { displayMode } = useContext(AppContext);
  const selectors = Object.values(get(style, `platform.${displayMode}`));
  const {
    schema: { flat }
  } = useContext(BuilderSchemaContext);
  const flatList = useMemo(() => Object.values(flat), [flat]);

  return (
    <div className="h-full flex flex-col grow overflow-auto">
      {/* <div className="m-1 flex justify-between items-center border-b border-gray-300" /> */}
      <div className="flex grow overflow-auto">
        <ManagerSelector selectors={selectors} flatList={flatList} selected={selected} onSelect={setSelected} />
        <ManagerModeBasic selected={selected} />
        {/* {mode === 'advanced' && <ManagerModeAdvanced selectors={selectors} selected={selected} />} */}
      </div>
    </div>
  );
};

export default StyleManager;
