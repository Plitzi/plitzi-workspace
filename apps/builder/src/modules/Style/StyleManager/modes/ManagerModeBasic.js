// Packages
import React, { useMemo, use } from 'react';
import noop from 'lodash/noop';
import get from 'lodash/get';

import BuilderStyleContext from '@plitzi/sdk-shared/builder/BuilderStyleContext';

// Relatives
import StyleInspector from '../../StyleInspector/StyleInspector';

/**
 * @param {{
 *   selected?: string;
 *   displayMode?: string;
 * }} props
 * @returns {React.ReactElement}
 */
const ManagerModeBasic = props => {
  const { selected, displayMode } = props;
  const { style } = use(BuilderStyleContext);
  const builderStyleValueMemo = useMemo(
    () => ({
      style,
      selectorSelected: get(style, `platform.${displayMode}.${selected}`),
      setSelectorSelected: noop,
      styleSelector: 'base',
      setStyleSelector: noop
    }),
    [style, selected]
  );

  return (
    <div className="flex flex-col grow basis-0 overflow-auto">
      {selected && (
        <BuilderStyleContext value={builderStyleValueMemo}>
          <StyleInspector mode="manager" styleSelectors={{ base: selected }} allowStyleSelector={false} />
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
