import get from 'lodash/get';
import { useState, use, useMemo } from 'react';

import BuilderSchemaContext from '@plitzi/sdk-shared/builder/contexts/BuilderSchemaContext';
import BuilderStyleContext from '@plitzi/sdk-shared/builder/contexts/BuilderStyleContext';

import ManagerSelector from './ManagerSelector';
import StyleInspector from '../StyleInspector';

const StyleManager = () => {
  const [selected, setSelected] = useState<string | undefined>(undefined);
  const {
    schema: { flat }
  } = use(BuilderSchemaContext);
  const flatList = useMemo(() => Object.values(flat), [flat]);
  const { style, displayMode } = use(BuilderStyleContext);
  const selectors = useMemo(() => Object.values(get(style, `platform.${displayMode}`, {})), [displayMode, style]);
  const styleSelectorsMemo = useMemo(() => {
    if (!selected) {
      return undefined;
    }

    return { base: selected };
  }, [selected]);
  const builderStyleValueMemo = useMemo(
    () => ({
      style,
      displayMode,
      selectorSelected: get(style, `platform.${displayMode}.${selected}`, undefined),
      setSelectorSelected: undefined,
      styleSelector: 'base',
      setStyleSelector: undefined
    }),
    [style, displayMode, selected]
  );

  return (
    <div className="h-full flex flex-col grow overflow-auto">
      <div className="flex grow overflow-auto">
        <ManagerSelector selectors={selectors} flatList={flatList} selected={selected} onSelect={setSelected} />
        <div className="flex flex-col grow basis-0 overflow-auto">
          {selected && (
            <BuilderStyleContext value={builderStyleValueMemo}>
              <StyleInspector mode="manager" styleSelectors={styleSelectorsMemo} allowStyleSelector={false} />
            </BuilderStyleContext>
          )}
          {!selected && (
            <div className="m-3 p-3 border-2 border-dashed border-gray-300 rounded-sm text-center select-none">
              No selector or element selected. Click on one to select it.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default StyleManager;
