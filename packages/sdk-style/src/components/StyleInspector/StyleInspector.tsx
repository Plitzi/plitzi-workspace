// import { useCache } from '@plitzi/plitzi-ui/Cache';
// import useStorage from '@plitzi/plitzi-ui/hooks/useStorage';
import classNames from 'classnames';
// import { useState } from 'react';

// import { emptyObject } from '@plitzi/sdk-shared';

import type { DisplayMode, Element } from '@plitzi/sdk-shared';

export type StyleInspectorProps = {
  element: Element;
  mode?: 'element' | 'manager';
  styleSelectors?: Element['definition']['styleSelectors'];
  allowStyleSelector?: boolean;
  displayMode?: DisplayMode;
};

const StyleInspector = ({
  // element,
  // mode = 'element',
  // styleSelectors = emptyObject,
  allowStyleSelector = true
}: StyleInspectorProps) => {
  // const [cache] = useStorage<{ viewMode: 'basic' }>('StyleInspector', { viewMode: 'basic' });
  // const [viewMode, setViewMode] = useState(cache.viewMode);
  // const {
  //   style: { platform },
  //   selectorSelected,
  //   setSelectorSelected,
  //   styleSelector,
  //   setStyleSelector
  // } = use(BuilderStyleContext);
  // const { builderHandler } = use(BuilderContext);
  // const selector = useMemo(() => get(styleSelectors, `${styleSelector}`, ''), [styleSelectors, styleSelector]);
  // const selectors = Object.values(get(platform, displayMode));
  // const { componentDefinitions } = use(ComponentContext);
  // const styleSelectorsAvailables = useMemo(
  //   () => get(componentDefinitions, `${get(element, 'definition.type', '')}.definition.styleSelectors`, {}),
  //   [componentDefinitions, element]
  // );

  return (
    <div className="w-full flex flex-col grow">
      <div className="flex flex-col w-full p-2 border-b border-gray-300">
        {/* {allowStyleSelector && (
          <div className="flex flex-col text-xs">
            <label>Selector</label>
            <Select className="rounded-sm" size="sm" onChange={handleChangeStyleSelector} value={styleSelector}>
              {Object.keys(styleSelectorsAvailables).map(selectorKey => (
                <option key={selectorKey} value={selectorKey}>
                  {selectorKey}
                </option>
              ))}
            </Select>
          </div>
        )} */}
        <div className={classNames('flex w-full', { 'mt-2': allowStyleSelector })}>
          {/* <Selector
            className="w-full min-h-[34px]"
            disabled={mode === 'manager'}
            value={selector}
            selectorSelected={selectorSelected}
            displayMode={displayMode}
            onChange={handleChangeSelector}
            onSelectorAdded={handleAddSelector}
            onSelectorRemoved={handleRemoveSelector}
            onSelectorSelected={handleCurrentSelector}
          />
          <Button
            className="rounded-sm ml-2 w-10 text-sm"
            size="custom"
            onClick={handleClicViewMode}
            title={viewMode === 'basic' ? 'Advanced Mode' : 'Basic Mode'}
            disabled={selectorSelected?.name?.includes(':')}
          >
            {viewMode === 'basic' && <i className="fa-solid fa-code" />}
            {viewMode === 'advanced' && <i className="fa-regular fa-hand-pointer" />}
          </Button> */}
        </div>
      </div>
      <div className="flex flex-col grow overflow-auto basis-0">
        {/* {viewMode === 'advanced' && (
          <InspectorModeAdvanced
            styleSelector={styleSelector}
            selectors={selectors}
            selector={selectorSelected?.name}
            element={element}
          />
        )}
        {viewMode === 'basic' && (
          <InspectorModeBasic styleSelector={styleSelector} selector={selectorSelected?.name} element={element} />
        )} */}
      </div>
    </div>
  );
};

export default StyleInspector;
