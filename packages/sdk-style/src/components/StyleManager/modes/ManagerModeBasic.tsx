import get from 'lodash/get';
import { use, useMemo } from 'react';

import BuilderStyleContext from '@plitzi/sdk-shared/builder/BuilderStyleContext';

import StyleInspector from '../../StyleInspector';

import type { DisplayMode } from '@plitzi/sdk-shared';

export type ManagerModeBasicProps = {
  selected?: string;
  displayMode: DisplayMode;
};

const ManagerModeBasic = ({ selected, displayMode }: ManagerModeBasicProps) => {
  const { style } = use(BuilderStyleContext);
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
    <div className="flex flex-col grow basis-0 overflow-auto">
      {selected && (
        <BuilderStyleContext value={builderStyleValueMemo}>
          <StyleInspector
            mode="manager"
            styleSelectors={styleSelectorsMemo}
            allowStyleSelector={false}
            displayMode={displayMode}
          />
        </BuilderStyleContext>
      )}
      {!selected && (
        <div className="m-3 p-3 border-2 border-dashed border-gray-300 rounded-sm text-center select-none">
          No selector or element selected. Click on one to select it.
        </div>
      )}
    </div>
  );
};

export default ManagerModeBasic;
