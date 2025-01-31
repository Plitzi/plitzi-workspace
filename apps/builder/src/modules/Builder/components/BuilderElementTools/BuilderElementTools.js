// Packages
import React, { use, useMemo, useState, useCallback, useRef } from 'react';
import get from 'lodash/get';
import classNames from 'classnames';
import useStateDebounce from '@plitzi/plitzi-ui-components/hooks/useStateDebounce';
import useCache from '@plitzi/plitzi-ui-components/Cache/useCache';

// Monorepo
import { EventBridgeTypes } from '@plitzi/sdk-event-bridge/EventBridgeHelper';

// Alias
import StyleInspector from '@pmodules/Style/StyleInspector';
import DataSourceBinding from '@pmodules/DataSource/DataSourceBinding';
import Interactions from '@pmodules/Interactions/Interactions';

// Relatives
import BuilderBreadcrumb from '../BuilderBreadcrumb';
import BuilderSelectedContext from '../../contexts/BuilderSelectedContext';
import useBuilderElement from '../../hooks/useBuilderElement';
import ElementSettings from './ElementSettings';
import ElementDefinitionSettings from './ElementDefinitionSettings';
import BuilderContext from '../../BuilderContext';

/**
 * @param {{
 *   initialTab?: string;r
 * }} props
 * @returns {React.ReactElement}
 */
const BuilderElementTools = props => {
  const { initialTab = 'style' } = props;
  const [, setCache, getCache] = useCache();
  const [selected, setSelected] = useState(() => getCache('BuilderElementTools.tabSelected', initialTab));
  const { builderHandler } = use(BuilderContext);
  const { elementSelected } = use(BuilderSelectedContext);
  const element = useBuilderElement(elementSelected);
  const attributes = useMemo(() => get(element, 'attributes', {}), [element]);
  const definition = useMemo(() => get(element, 'definition', {}), [element]);
  const elementRef = useRef(element);
  elementRef.current = element;

  const handleClickListItems = item => () => {
    setSelected(item);
    setCache(item, 'BuilderElementTools.tabSelected');
  };

  const [tempAttributes, setTempAttributes] = useStateDebounce(
    attributes,
    useCallback(
      state => builderHandler(EventBridgeTypes.SCHEMA_UPDATE_ELEMENT, { ...elementRef.current, attributes: state }),
      [builderHandler]
    ),
    500
  );

  const [tempDefinition, setTempDefinition] = useStateDebounce(
    definition,
    useCallback(
      state => builderHandler(EventBridgeTypes.SCHEMA_UPDATE_ELEMENT, { ...elementRef.current, definition: state }),
      [builderHandler]
    ),
    500
  );

  const handleChange = useCallback(
    (key, value, isDefinition = false) => {
      if (isDefinition) {
        setTempDefinition(state => ({ ...state, [key]: value }));
      } else {
        setTempAttributes(state => ({ ...state, [key]: value }));
      }
    },
    [setTempAttributes]
  );

  const handleChangeBinding = useCallback(
    bindings => {
      const { definition } = element;
      builderHandler(EventBridgeTypes.SCHEMA_UPDATE_ELEMENT, { ...element, definition: { ...definition, bindings } });
    },
    [builderHandler, element]
  );

  const handleChangeInteractions = useCallback(
    interactions => {
      const { definition } = element;
      builderHandler(EventBridgeTypes.SCHEMA_UPDATE_ELEMENT, {
        ...element,
        definition: { ...definition, interactions }
      });
    },
    [builderHandler, element]
  );

  if (!element) {
    return (
      <div className="m-3 p-3 border-2 border-dashed border-gray-300 rounded-sm text-center self-start">
        Click on a component to select it
      </div>
    );
  }

  const {
    definition: { type, bindings, interactions }
  } = element;

  return (
    <div className={classNames('flex flex-col grow', { [`element-${type}`]: type })}>
      <div className="top-0 sticky z-10 flex flex-col bg-white shadow-[rgba(0,15,51,0.2)_0px_1px_3px_0px]">
        <ul className="w-full m-0 p-0 flex justify-around list-type-none border-b border-gray-300">
          <li
            className={classNames(
              'p-1.5 flex items-center justify-center border-b-4 grow basis-0 cursor-pointer hover:text-blue-400',
              {
                'border-transparent': selected !== 'style',
                'border-blue-400 text-blue-400': selected === 'style'
              }
            )}
            onClick={handleClickListItems('style')}
            title="Style"
          >
            <i className="fas fa-palette" />
          </li>
          <li
            className={classNames(
              'p-1.5 flex items-center justify-center border-b-4 grow basis-0 cursor-pointer hover:text-blue-400',
              {
                'border-transparent': selected !== 'settings',
                'border-blue-400 text-blue-400': selected === 'settings'
              }
            )}
            onClick={handleClickListItems('settings')}
            title="Settings"
          >
            <i className="fas fa-cog" />
          </li>
          <li
            className={classNames(
              'p-1.5 flex items-center justify-center border-b-4 grow basis-0 cursor-pointer hover:text-blue-400',
              {
                'border-transparent': selected !== 'bindings',
                'border-blue-400 text-blue-400': selected === 'bindings'
              }
            )}
            onClick={handleClickListItems('bindings')}
            title="Bindings"
          >
            <i className="fas fa-link" />
          </li>
          <li
            className={classNames(
              'p-1.5 flex items-center justify-center border-b-4 grow basis-0 cursor-pointer hover:text-blue-400',
              {
                'border-transparent': selected !== 'interactions',
                'border-blue-400 text-blue-400': selected === 'interactions'
              }
            )}
            onClick={handleClickListItems('interactions')}
            title="Interactions"
          >
            <i className="fas fa-bolt" />
          </li>
        </ul>
        <BuilderBreadcrumb limit={4} />
      </div>
      <div className="flex flex-col grow overflow-y-auto basis-0">
        {selected === 'style' && (
          <StyleInspector mode="element" element={element} styleSelectors={tempDefinition.styleSelectors} />
        )}
        {selected === 'settings' && (
          <>
            <ElementDefinitionSettings definition={tempDefinition} onUpdate={handleChange} />
            <ElementSettings attributes={tempAttributes} id={elementSelected} type={type} handleChange={handleChange} />
          </>
        )}
        {selected === 'bindings' && (
          <DataSourceBinding
            onChange={handleChangeBinding}
            id={elementSelected}
            bindings={bindings}
            allowCustomBindings={type === 'custom' || type === 'blockJsx' || type === 'blockHtml'}
            element={element}
          />
        )}
        {selected === 'interactions' && (
          <Interactions id={elementSelected} interactions={interactions} onChange={handleChangeInteractions} />
        )}
      </div>
    </div>
  );
};

export default BuilderElementTools;
