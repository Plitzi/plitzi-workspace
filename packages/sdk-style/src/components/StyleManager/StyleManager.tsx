import get from 'lodash/get';
import { useState, use, useMemo } from 'react';

import BuilderSchemaContext from '@plitzi/sdk-shared/builder/contexts/BuilderSchemaContext';
import BuilderStyleContext from '@plitzi/sdk-shared/builder/contexts/BuilderStyleContext';

import ManagerSelector from './ManagerSelector';
import ManagerModeBasic from './modes/ManagerModeBasic';

import type { StyleItem } from '@plitzi/sdk-shared';

const StyleManager = () => {
  const [selected, setSelected] = useState<string | undefined>(undefined);
  const {
    schema: { flat }
  } = use(BuilderSchemaContext);
  const flatList = useMemo(() => Object.values(flat), [flat]);
  const { style, displayMode } = use(BuilderStyleContext);
  const selectors = useMemo(
    () => Object.values(get(style, `platform.${displayMode}`, {}) as Record<string, StyleItem>),
    [displayMode, style]
  );

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
