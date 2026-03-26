import { get } from '@plitzi/plitzi-ui/helpers';
import { useState, use, useMemo } from 'react';

import BuilderSchemaContext from '@plitzi/sdk-shared/builder/contexts/BuilderSchemaContext';
import BuilderStyleContext from '@plitzi/sdk-shared/builder/contexts/BuilderStyleContext';
import ComponentContext from '@plitzi/sdk-shared/elements/ComponentContext';

import ManagerSelector from './ManagerSelector';
import StyleInspector from '../StyleInspector';

import type { StyleItem } from '@plitzi/sdk-shared';

const StyleManager = () => {
  const { componentDefinitions } = use(ComponentContext);
  const [selector, setSelector] = useState<StyleItem | undefined>(undefined);
  const {
    schema: { flat }
  } = use(BuilderSchemaContext);
  const flatList = useMemo(() => Object.values(flat), [flat]);
  const { style, displayMode } = use(BuilderStyleContext);
  const selectors = useMemo(() => Object.values(get(style, `platform.${displayMode}`, {})), [displayMode, style]);

  const styleSelectorsAvailables = useMemo(
    () =>
      selector?.type === 'element'
        ? Object.keys(get(componentDefinitions.current, `${selector.componentType}.definition.styleSelectors`, {}))
        : ['base'],
    [componentDefinitions, selector]
  );

  const styleSelectors = useMemo<({ base: string } & Record<string, string>) | undefined>(() => {
    if (!selector) {
      return undefined;
    }

    if (selector.type === 'element' && styleSelectorsAvailables.length > 1) {
      return styleSelectorsAvailables.reduce((acum, key) => ({ ...acum, [key]: selector.componentType }), {}) as {
        base: string;
      } & Record<string, string>;
    }

    return { base: selector.name };
  }, [selector, styleSelectorsAvailables]);

  return (
    <div className="flex h-full grow flex-col overflow-auto">
      <div className="flex grow overflow-auto">
        <ManagerSelector selectors={selectors} flatList={flatList} selected={selector?.name} onSelect={setSelector} />
        <div className="flex grow basis-0 flex-col overflow-auto">
          {selector && (
            <StyleInspector
              mode="manager"
              styleSelectors={styleSelectors}
              styleSelectorsAvailables={styleSelectorsAvailables}
              allowStyleSelector={selector.type === 'element'}
              componentType={selector.componentType}
              value={selector.name}
            />
          )}
          {!selector && (
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
