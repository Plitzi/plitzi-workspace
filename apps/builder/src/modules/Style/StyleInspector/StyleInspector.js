// Packages
import React, { useCallback, use, useEffect, useMemo, useState } from 'react';
import set from 'lodash/set';
import get from 'lodash/get';
import classNames from 'classnames';
import { ComponentContext } from '@plitzi/plitzi-sdk';
import { produce } from 'immer';
import Button from '@plitzi/plitzi-ui-components/Button';
import Select from '@plitzi/plitzi-ui-components/Select';
import useCache from '@plitzi/plitzi-ui-components/Cache/useCache';

// Monorepo
import { EventBridgeTypes } from '@plitzi/sdk-event-bridge/EventBridgeHelper';
import { emptyObject } from '@plitzi/sdk-shared/utils';

// Alias
import AppContext from '@pmodules/App/AppContext';
import BuilderStyleContext from '@pmodules/Builder/contexts/BuilderStyleContext';
import BuilderContext from '@pmodules/Builder/BuilderContext';

// Relatives
import Selector from '../Selector';
import InspectorModeAdvanced from './modes/InspectorModeAdvanced';
import InspectorModeBasic from './modes/InspectorModeBasic';

/**
 * @param {{
 *   mode?: 'element' | 'manager';
 *   styleSelectors?: object;
 *   element?: object;
 *   allowStyleSelector?: boolean;
 * }} props
 * @returns {React.ReactElement}
 */
const StyleInspector = props => {
  const { mode = 'element', styleSelectors = emptyObject, element, allowStyleSelector = true } = props;
  const { displayMode } = use(AppContext);
  const [, setCache, getCacheByKey] = useCache();
  const viewModeCache = useMemo(() => getCacheByKey('StyleInspector.viewMode', 'basic'), []);
  const [viewMode, setViewMode] = useState(viewModeCache);
  const {
    style: { platform },
    selectorSelected,
    setSelectorSelected
  } = use(BuilderStyleContext);
  const [styleSelector, setStyleSelector] = useState('base');
  const { builderHandler } = use(BuilderContext);
  const selector = useMemo(() => get(styleSelectors, `${styleSelector}`, ''), [styleSelectors, styleSelector]);
  const selectors = Object.values(get(platform, displayMode));
  const { componentDefinitions } = use(ComponentContext);
  const styleSelectorsAvailables = useMemo(
    () => get(componentDefinitions, `${get(element, 'definition.type', '')}.definition.styleSelectors`, {}),
    [componentDefinitions, element]
  );

  useEffect(() => {
    if (styleSelector !== 'base') {
      setStyleSelector('base');
    }
  }, [element?.id]);

  const handleChangeSelector = useCallback(
    value => {
      if (!element) {
        return;
      }

      builderHandler(
        EventBridgeTypes.SCHEMA_UPDATE_ELEMENT,
        produce(element, draft => {
          set(draft, `definition.styleSelectors.${styleSelector}`, value);
        })
      );
    },
    [element, builderHandler, styleSelector]
  );

  const handleAddSelector = useCallback(
    (tag, isDuplicated, originalTag) => {
      if (!tag || (isDuplicated && !originalTag)) {
        return;
      }

      const { name, type } = tag;
      if (!isDuplicated && name !== '' && !platform[displayMode][name]) {
        builderHandler(EventBridgeTypes.STYLE_ADD_SELECTOR, displayMode, name, type);
      } else if (
        isDuplicated &&
        originalTag &&
        tag &&
        originalTag.name !== name &&
        platform[displayMode][originalTag.name] &&
        !platform[displayMode][name]
      ) {
        builderHandler(
          EventBridgeTypes.STYLE_ADD_SELECTOR,
          displayMode,
          name,
          type,
          '',
          get(platform, `${displayMode}.${originalTag.name}.attributes`, {})
        );
      }
    },
    [builderHandler, displayMode, platform]
  );

  const handleRemoveSelector = useCallback(() => {}, []);

  const handleClicViewMode = useCallback(
    () =>
      setViewMode(state => {
        const newState = state === 'basic' ? 'advanced' : 'basic';
        setCache(newState, 'StyleInspector.viewMode');

        return newState;
      }),
    [setViewMode]
  );

  const handleChangeStyleSelector = useCallback(e => setStyleSelector(e.target.value), []);

  const handleCurrentSelector = useCallback(tag => setSelectorSelected(tag), []);

  return (
    <div className="w-full flex flex-col grow">
      <div className="flex flex-col w-full p-2 border-b border-gray-300">
        {allowStyleSelector && (
          <div className="flex flex-col text-xs">
            <label>Selector</label>
            <Select className="rounded" size="sm" onChange={handleChangeStyleSelector} value={styleSelector}>
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
            onChange={handleChangeSelector}
            onSelectorAdded={handleAddSelector}
            onSelectorRemoved={handleRemoveSelector}
            onSelectorSelected={handleCurrentSelector}
            disabled={mode === 'manager'}
            value={selector}
            selectorSelected={selectorSelected}
            displayMode={displayMode}
          />
          <Button
            className="rounded ml-2 w-10 text-sm"
            size="custom"
            onClick={handleClicViewMode}
            title={viewMode === 'basic' ? 'Advanced Mode' : 'Basic Mode'}
            disabled={selectorSelected?.name.includes(':')}
          >
            {viewMode === 'basic' && <i className="fa-solid fa-code" />}
            {viewMode === 'advanced' && <i className="fa-regular fa-hand-pointer" />}
          </Button>
        </div>
      </div>
      <div className="flex flex-col grow overflow-auto basis-0 bg-slate-100">
        {viewMode === 'advanced' && (
          <InspectorModeAdvanced
            styleSelector={styleSelector}
            selectors={selectors}
            selector={selectorSelected?.name}
            element={element}
          />
        )}
        {viewMode === 'basic' && (
          <InspectorModeBasic styleSelector={styleSelector} selector={selectorSelected?.name} element={element} />
        )}
      </div>
    </div>
  );
};

export default StyleInspector;
