// Packages
import React, { use, useMemo, useState, useCallback, useRef } from 'react';
import get from 'lodash/get';
import classNames from 'classnames';
import useStateDebounce from '@plitzi/plitzi-ui-components/hooks/useStateDebounce';
import useCache from '@plitzi/plitzi-ui-components/Cache/useCache';

// Monorepo
import { EventBridgeTypes } from '@plitzi/sdk-event-bridge/EventBridgeHelper';
import BuilderContext from '@plitzi/sdk-shared/builder/contexts/BuilderContext';
import BuilderSelectedContext from '@plitzi/sdk-shared/builder/contexts/BuilderSelectedContext';
import StyleInspector from '@plitzi/sdk-style/components/StyleInspector';

// Alias
import DataSourceBinding from '@pmodules/DataSource/DataSourceBinding';
import Interactions from '@pmodules/Interactions/Interactions';

// Relatives
import BuilderBreadcrumb from '../BuilderBreadcrumb';
import useBuilderElement from '../../hooks/useBuilderElement';
import ElementSettings from './ElementSettings';
import ElementDefinitionSettings from './ElementDefinitionSettings';
import ToolsList from '../ToolsList';

/**
 * @param {{
 *   initialTab?: string;
 * }} props
 * @returns {React.ReactElement}
 */
const BuilderElementTools = ({ initialTab = 'style' }) => {
  const [, setCache, getCache] = useCache();
  const [selected, setSelected] = useState(() => getCache('BuilderElementTools.tabSelected', initialTab));
  const { builderHandler } = use(BuilderContext);
  const { elementSelected } = use(BuilderSelectedContext);
  const element = useBuilderElement(elementSelected);
  const attributes = useMemo(() => get(element, 'attributes', {}), [element]);
  const definition = useMemo(() => get(element, 'definition', {}), [element]);
  const elementRef = useRef(element);
  elementRef.current = element;

  const handleClickListItems = useCallback(
    item => {
      setSelected(item);
      setCache(item, 'BuilderElementTools.tabSelected');
    },
    [setCache]
  );

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
      <div className="m-3 p-3 border-2 border-dashed border-gray-300 rounded-sm text-center self-start w-full">
        Click on a component to select it
      </div>
    );
  }

  const {
    definition: { type, bindings, interactions }
  } = element;

  return (
    <div className={classNames('flex flex-col grow min-w-0 gap-4', { [`element-${type}`]: type })}>
      <ToolsList onSelect={handleClickListItems} selected={selected} />
      <BuilderBreadcrumb limit={4} />
      <div className="flex flex-col grow overflow-y-auto basis-0">
        {selected === 'style' && (
          <div className="flex flex-col grow gap-2">
            <StyleInspector mode="element" element={element} styleSelectors={tempDefinition.styleSelectors} />
          </div>
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
