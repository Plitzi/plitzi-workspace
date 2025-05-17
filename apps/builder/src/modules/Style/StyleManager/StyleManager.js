// Packages
import React, { use, useMemo, useState } from 'react';
import get from 'lodash/get';

import BuilderSchemaContext from '@plitzi/sdk-shared/builder/contexts/BuilderSchemaContext';
import BuilderStyleContext from '@plitzi/sdk-shared/builder/contexts/BuilderStyleContext';

// Alias
import AppContext from '@pmodules/App/AppContext';

// Relatives
import ManagerModeBasic from './modes/ManagerModeBasic';
import ManagerSelector from './ManagerSelector';

/** @returns {React.ReactElement} */
const StyleManager = () => {
  const [selected, setSelected] = useState();
  const { style } = use(BuilderStyleContext);
  const { displayMode } = use(AppContext);
  const selectors = Object.values(get(style, `platform.${displayMode}`));
  const {
    schema: { flat }
  } = use(BuilderSchemaContext);
  const flatList = useMemo(() => Object.values(flat), [flat]);

  return (
    <div className="h-full flex flex-col grow overflow-auto">
      {/* <div className="m-1 flex justify-between items-center border-b border-gray-300" /> */}
      <div className="flex grow overflow-auto">
        <ManagerSelector selectors={selectors} flatList={flatList} selected={selected} onSelect={setSelected} />
        <ManagerModeBasic selected={selected} displayMode={displayMode} />
        {/* {mode === 'advanced' && <ManagerModeAdvanced selected={selected} displayMode={displayMode} />} */}
      </div>
    </div>
  );
};

export default StyleManager;
