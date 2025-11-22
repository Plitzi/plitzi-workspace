import useStorage from '@plitzi/plitzi-ui/hooks/useStorage';
import Select from '@plitzi/plitzi-ui/Select';
import Switch from '@plitzi/plitzi-ui/Switch';
import { produce } from 'immer';
import get from 'lodash-es/get.js';
import pick from 'lodash-es/pick.js';
import set from 'lodash-es/set.js';
import { use, useCallback, useMemo } from 'react';

import BuilderContext from '@plitzi/sdk-shared/builder/contexts/BuilderContext';
import BuilderStyleContext from '@plitzi/sdk-shared/builder/contexts/BuilderStyleContext';
import ComponentContext from '@plitzi/sdk-shared/elements/ComponentContext';

import Selector from '../Selector';
import InspectorModeAdvanced from './modes/InspectorModeAdvanced';
import InspectorModeBasic from './modes/InspectorModeBasic';

import type { SelectorValue } from '../Selector';
import type { Element, StyleItem } from '@plitzi/sdk-shared';

export type StyleInspectorProps = {
  element?: Element;
  mode?: 'element' | 'manager';
  styleSelectors?: Element['definition']['styleSelectors'];
  allowStyleSelector?: boolean;
};

const StyleInspector = ({
  element,
  mode = 'element',
  styleSelectors,
  allowStyleSelector = true
}: StyleInspectorProps) => {
  const [cache, setCache] = useStorage<{ viewMode: 'basic' | 'advanced' }>('builder-state.styleInspector', {
    viewMode: 'basic'
  });
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
  const selectors = useMemo(
    () => Object.values(pick(get(style.platform, displayMode), selector.split(' '))),
    [style, displayMode, selector]
  );
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

  const handleChangeStyleSelector = useCallback((value: string) => setStyleSelector?.(value), [setStyleSelector]);

  return (
    <div className="flex w-full grow flex-col">
      <div className="flex w-full flex-col gap-1 border-b border-gray-300 py-2">
        <div className="flex items-center justify-between">
          <label>Style Selector</label>
          <div className="flex items-center gap-2 py-1 text-xs">
            Dev Mode
            <Switch
              size="sm"
              intent="secondary"
              checked={cache.viewMode === 'advanced'}
              onChange={handleClicViewMode}
              disabled={selectorSelected?.name.includes(':')}
            />
          </div>
        </div>
        <Selector
          className="min-h-0 w-full"
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
        {allowStyleSelector && Object.keys(styleSelectorsAvailables).length > 1 && (
          <div className="flex flex-col text-xs">
            <Select className="rounded-sm" size="xs" onChange={handleChangeStyleSelector} value={styleSelector}>
              {Object.keys(styleSelectorsAvailables).map(selectorKey => (
                <option key={selectorKey} value={selectorKey}>
                  {selectorKey}
                </option>
              ))}
            </Select>
          </div>
        )}
      </div>
      <div className="flex grow basis-0 flex-col overflow-auto">
        {cache.viewMode === 'advanced' && (
          <InspectorModeAdvanced selectors={selectors} selector={selectorSelected?.name} displayMode={displayMode} />
        )}
        {cache.viewMode === 'basic' && (
          <InspectorModeBasic
            styleSelector={styleSelector}
            selector={selectorSelected?.name}
            element={element}
            displayMode={displayMode}
          />
        )}
      </div>
    </div>
  );
};

export default StyleInspector;
