import Button from '@plitzi/plitzi-ui/Button';
import useStorage from '@plitzi/plitzi-ui/hooks/useStorage';
import Select from '@plitzi/plitzi-ui/Select';
import classNames from 'classnames';
import { produce } from 'immer';
import get from 'lodash/get';
import set from 'lodash/set';
import { use, useCallback, useMemo } from 'react';

import ComponentContext from '@plitzi/sdk-elements/ComponentContext';
import BuilderContext from '@plitzi/sdk-shared/builder/BuilderContext';
import BuilderStyleContext from '@plitzi/sdk-shared/builder/BuilderStyleContext';

import Selector from '../Selector';

import type { SelectorValue } from '../Selector';
import type { DisplayMode, Element, StyleItem } from '@plitzi/sdk-shared';

export type StyleInspectorProps = {
  element?: Element;
  mode?: 'element' | 'manager';
  styleSelectors?: Element['definition']['styleSelectors'];
  allowStyleSelector?: boolean;
  displayMode: DisplayMode;
};

const StyleInspector = ({
  element,
  mode = 'element',
  styleSelectors,
  allowStyleSelector = true
}: StyleInspectorProps) => {
  const [cache, setCache] = useStorage<{ viewMode: 'basic' | 'advanced' }>('StyleInspector', { viewMode: 'basic' });
  const { componentDefinitions } = use(ComponentContext);
  const {
    style,
    displayMode,
    style: { platform },
    selectorSelected,
    setSelectorSelected,
    styleSelector,
    setStyleSelector
  } = use(BuilderStyleContext);
  const selector = useMemo(() => get(styleSelectors, styleSelector, ''), [styleSelectors, styleSelector]);
  // const selectors = Object.values(get(style.platform, displayMode));
  const { builderHandler } = use(BuilderContext);
  const styleSelectorsAvailables = useMemo<Element['definition']['styleSelectors']>(
    () =>
      get(
        componentDefinitions,
        `${get(element, 'definition.type', '')}.definition.styleSelectors`,
        {}
      ) as Element['definition']['styleSelectors'],
    [componentDefinitions, element]
  );

  const handleAddSelector = useCallback(
    (selector: SelectorValue, isDuplicated: boolean, originalSelector?: SelectorValue) => {
      if (isDuplicated && !originalSelector) {
        return;
      }

      const { name, type } = selector;
      if (!isDuplicated && name !== '' && !(platform[displayMode][name] as StyleItem | undefined)) {
        builderHandler('styleAddSelector', displayMode, name, type);
      } else if (
        isDuplicated &&
        originalSelector &&
        originalSelector.name !== name &&
        (platform[displayMode][originalSelector.name] as StyleItem | undefined) &&
        !(platform[displayMode][name] as StyleItem | undefined)
      ) {
        builderHandler(
          'styleAddSelector',
          displayMode,
          name,
          type,
          '',
          get(platform, `${displayMode}.${originalSelector.name}.attributes`, {})
        );
      }
    },
    [builderHandler, displayMode, platform]
  );

  const handleChangeSelector = useCallback(
    (value: string) => {
      if (!element) {
        return;
      }

      builderHandler(
        'schemaUpdateElement',
        produce(element, draft => {
          set(draft, `definition.styleSelectors.${styleSelector}`, value);
        })
      );
    },
    [element, builderHandler, styleSelector]
  );

  const handleRemoveSelector = useCallback(() => {}, []);

  const handleClicViewMode = useCallback(
    () => setCache(state => ({ viewMode: state.viewMode === 'basic' ? 'advanced' : 'basic' })),
    [setCache]
  );

  const handleChangeStyleSelector = useCallback((value: string) => setStyleSelector(value), [setStyleSelector]);

  return (
    <div className="w-full flex flex-col grow">
      <div className="flex flex-col w-full p-2 border-b border-gray-300">
        {allowStyleSelector && (
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
        )}
        <div className={classNames('flex w-full', { 'mt-2': allowStyleSelector })}>
          <Selector
            className="w-full min-h-[34px]"
            style={style}
            disabled={mode === 'manager'}
            value={selector}
            selectorSelected={selectorSelected}
            displayMode={displayMode}
            onAdd={handleAddSelector}
            onChange={handleChangeSelector}
            onRemove={handleRemoveSelector}
            onSelectorSelected={setSelectorSelected}
          />
          <Button
            className="rounded-sm ml-2 w-10 text-sm"
            size="custom"
            onClick={handleClicViewMode}
            title={cache.viewMode === 'basic' ? 'Advanced Mode' : 'Basic Mode'}
            disabled={selectorSelected?.name.includes(':')}
          >
            {cache.viewMode === 'basic' && <i className="fa-solid fa-code" />}
            {cache.viewMode === 'advanced' && <i className="fa-regular fa-hand-pointer" />}
          </Button>
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
