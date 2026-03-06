import { get } from '@plitzi/plitzi-ui/helpers';
import { useState, use, useMemo, useCallback } from 'react';

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
  const [selector, setSelector] = useState<string | undefined>();
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

  const handleChange = useCallback((value?: string) => setSelector(value), []);

  return (
    <div className="flex h-full grow flex-col overflow-auto">
      <div className="flex grow overflow-auto">
        <ManagerSelector selectors={selectors} flatList={flatList} selected={selected} onSelect={setSelected} />
        <div className="flex grow basis-0 flex-col overflow-auto">
          {selected && (
            <BuilderStyleContext value={builderStyleValueMemo}>
              <StyleInspector
                mode="manager"
                styleSelectors={styleSelectorsMemo}
                allowStyleSelector={false}
                value={selector}
                onChange={handleChange}
              />
            </BuilderStyleContext>
          )}
          {!selected && (
            <div className="m-3 rounded-sm border-2 border-dashed border-gray-300 p-3 text-center select-none">
              No selector or element selected. Click on one to select it.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default StyleManager;
