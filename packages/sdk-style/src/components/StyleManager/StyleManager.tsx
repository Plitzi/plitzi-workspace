import { get } from '@plitzi/plitzi-ui/helpers';
import { useState, use, useMemo } from 'react';

import { createStoreHook } from '@plitzi/nexus/createStore';
import ComponentContext from '@plitzi/sdk-shared/elements/ComponentContext';

import ManagerSelector from './ManagerSelector';
import StyleInspector from '../StyleInspector';

import type { BuilderState, StyleItem } from '@plitzi/sdk-shared';

const StyleManager = () => {
  const { componentDefinitions } = use(ComponentContext);
  const [selector, setSelector] = useState<StyleItem | undefined>(undefined);

  const { useStore } = createStoreHook<BuilderState>();
  const [[flat, displayMode]] = useStore(['schema.flat', 'displayMode']);
  const [selectors] = useStore(`style.platform.${displayMode}`);

  const flatList = useMemo(() => Object.values(flat), [flat]);

  const styleSelectorsAvailables = useMemo(
    () =>
      selector?.type === 'element'
        ? Object.keys(get(componentDefinitions.current, `${selector.componentType}.definition.styleSelectors`, {}))
        : ['base'],
    [componentDefinitions, selector]
  );

  const componentSubTypesAvailables = useMemo(
    () =>
      selector?.type === 'element'
        ? Object.keys(get(componentDefinitions.current, `${selector.componentType}.defaultStyle.subTypes`, {}))
        : [],
    [componentDefinitions, selector]
  );

  const styleSelectors = useMemo<Record<string, string> | undefined>(() => {
    if (!selector) {
      return undefined;
    }

    if (selector.type === 'element' && styleSelectorsAvailables.length > 1) {
      return styleSelectorsAvailables.reduce((acum, key) => ({ ...acum, [key]: selector.componentType }), {});
    }

    return { base: selector.name };
  }, [selector, styleSelectorsAvailables]);

  return (
    <div className="flex h-full grow flex-col overflow-auto">
      <div className="flex grow overflow-auto">
        <ManagerSelector
          displayMode={displayMode}
          selectors={selectors}
          flatList={flatList}
          selected={selector?.name}
          onSelect={setSelector}
        />
        <div className="flex grow basis-0 flex-col overflow-auto">
          {selector && (
            <StyleInspector
              mode="manager"
              displayMode={displayMode}
              selectors={selectors}
              styleSelectors={styleSelectors}
              styleSelectorsAvailables={styleSelectorsAvailables}
              componentSubTypesAvailables={componentSubTypesAvailables}
              allowStyleSelector={selector.type === 'element'}
              componentType={selector.componentType}
              value={selector.name}
            />
          )}
          {!selector && (
            <div className="m-3 rounded-sm border-2 border-dashed border-gray-300 p-3 text-center text-zinc-500 select-none dark:border-zinc-600 dark:text-zinc-400">
              No selector or element selected. Click on one to select it.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default StyleManager;
