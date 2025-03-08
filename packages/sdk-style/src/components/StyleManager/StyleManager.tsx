import { useMemo, useState } from 'react';

import ManagerSelector from './ManagerSelector';
import ManagerModeBasic from './modes/ManagerModeBasic';

import type { Schema, StyleItem } from '@plitzi/sdk-shared';

export type StyleManagerProps = {
  displayMode: string;
  selectors: StyleItem[];
  flat: Schema['flat'];
};

const StyleManager = ({ displayMode, selectors, flat }: StyleManagerProps) => {
  const [selected, setSelected] = useState();
  const flatList = useMemo(() => Object.values(flat), [flat]);

  return (
    <div className="h-full flex flex-col grow overflow-auto">
      {/* <div className="m-1 flex justify-between items-center border-b border-gray-300" /> */}
      <div className="flex grow overflow-auto">
        {/* <ManagerSelector selectors={selectors} flatList={flatList} selected={selected} onSelect={setSelected} /> */}
        <ManagerModeBasic selected={selected} displayMode={displayMode} />
        {/* {mode === 'advanced' && <ManagerModeAdvanced selected={selected} displayMode={displayMode} />} */}
      </div>
    </div>
  );
};

export default StyleManager;
