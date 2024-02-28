// Packages
import React, { useCallback, useContext, useEffect, useMemo, useState } from 'react';
import PropTypes from 'prop-types';
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

// Alias
import AppContext from '@pmodules/App/AppContext';
import BuilderStyleContext from '@pmodules/Builder/contexts/BuilderStyleContext';
import BuilderContext from '@pmodules/Builder/BuilderContext';

// Relatives
import Selector from '../Selector';
import InspectorModeAdvanced from './modes/InspectorModeAdvanced';
import InspectorModeBasic from './modes/InspectorModeBasic';
import { emptyObject } from '../../../helpers/utils';
import { StyleSelectors } from '../StyleHelper';

const StyleInspector = props => {
  const { mode = 'element', styleSelectors = emptyObject, element, allowStyleSelector = true } = props;
  const { displayMode } = useContext(AppContext);
  const [, setCache, getCacheByKey] = useCache();
  const viewModeCache = useMemo(() => getCacheByKey('StyleInspector.viewMode', 'basic'), []);
  const [viewMode, setViewMode] = useState(viewModeCache);
  const {
    style: { platform }
  } = useContext(BuilderStyleContext);
  const [styleSelector, setStyleSelector] = useState('base');
  const { builderHandler } = useContext(BuilderContext);
  const selector = useMemo(() => get(styleSelectors, `${styleSelector}`, ''), [styleSelectors, styleSelector]);
  const selectors = Object.values(get(platform, displayMode));
  const { componentDefinitions } = useContext(ComponentContext);
  const styleSelectorsAvailables = useMemo(
    () => get(componentDefinitions, `${get(element, 'definition.type', '')}.definition.styleSelectors`, {}),
    [componentDefinitions, element]
  );

  useEffect(() => {
    setStyleSelector('base');
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
      if (value !== '' && !platform[displayMode][value]) {
        builderHandler(EventBridgeTypes.STYLE_ADD_SELECTOR, displayMode, value, StyleSelectors.SELECTOR_CLASS);
      }
    },
    [element, builderHandler, styleSelector]
  );

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
            className="w-full"
            onChange={handleChangeSelector}
            disabled={mode === 'manager'}
            value={styleSelectors[styleSelector]}
            displayMode={displayMode}
          />
          <Button
            className="rounded ml-2 w-10 text-sm"
            size="custom"
            onClick={handleClicViewMode}
            title={viewMode === 'basic' ? 'Advanced Mode' : 'Basic Mode'}
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
            selector={selector}
            element={element}
          />
        )}
        {viewMode === 'basic' && (
          <InspectorModeBasic styleSelector={styleSelector} selector={selector} element={element} />
        )}
      </div>
    </div>
  );
};

StyleInspector.propTypes = {
  className: PropTypes.string,
  mode: PropTypes.oneOf(['element', 'manager']),
  styleSelectors: PropTypes.object,
  element: PropTypes.object,
  allowStyleSelector: PropTypes.bool
};

export default StyleInspector;
