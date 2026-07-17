import { get } from '@plitzi/plitzi-ui/helpers';
import useStateDebounce from '@plitzi/plitzi-ui/hooks/useStateDebounce';
import useStorage from '@plitzi/plitzi-ui/hooks/useStorage';
import clsx from 'clsx';
import { use, useMemo, useCallback, useRef } from 'react';

import { idRefConflict } from '@plitzi/sdk-schema/helpers/idRef';
import BuilderContext from '@plitzi/sdk-shared/builder/contexts/BuilderContext';
import ComponentContext from '@plitzi/sdk-shared/elements/ComponentContext';
import { useBuilderStore, useBuilderStoreGetter } from '@plitzi/sdk-shared/store';
import StyleInspector from '@plitzi/sdk-style/components/StyleInspector';
import DataSourceBinding from '@pmodules/DataSource/DataSourceBinding';
import Interactions from '@pmodules/Interactions/Interactions';

import BuilderBreadcrumb from '../BuilderBreadcrumb';
import ElementDefinitionSettings from './ElementDefinitionSettings';
import ElementSettings from './ElementSettings';
import ToolsList from '../ToolsList';

import type { Element } from '@plitzi/sdk-shared';

export type BuilderElementToolsProps = {
  initialTab?: string;
};

const BuilderElementTools = ({ initialTab = 'style' }: BuilderElementToolsProps) => {
  const [selected, setSelected] = useStorage('builder-state.elementTools.tabSelected', initialTab);
  const { builderHandler } = use(BuilderContext);
  const [[selector, elementSelected], setSelector] = useBuilderStore(['selector', 'elementSelected']);
  const [displayMode] = useBuilderStore('displayMode');
  const [[selectors = undefined, element = undefined]] = useBuilderStore([
    `style.platform.${displayMode}`,
    `schema.flat.${elementSelected}`
  ]);
  const { componentDefinitions } = use(ComponentContext);
  const getSchemaFlat = useBuilderStoreGetter('schema.flat');
  const attributes = useMemo(() => get(element, 'attributes', {} as Element['attributes']), [element]);
  const definition = useMemo(() => get(element, 'definition', {} as Element['definition']), [element]);
  const elementRef = useRef(element);
  elementRef.current = element;

  const styleSelectorsAvailables = useMemo(
    () => Object.keys(get(componentDefinitions.current, `${element?.definition.type}.definition.styleSelectors`, {})),
    [componentDefinitions, element?.definition.type]
  );

  const handleClickListItems = useCallback((item: string) => setSelected(item), [setSelected]);

  const [tempAttributes, setTempAttributes] = useStateDebounce(
    attributes,
    useCallback(
      (state: Element['attributes']) =>
        builderHandler('schemaUpdateElement', { ...elementRef.current, attributes: state }),
      [builderHandler]
    ),
    500
  );

  const [tempDefinition, setTempDefinition] = useStateDebounce(
    definition,
    useCallback(
      (state: Element['definition']) =>
        builderHandler('schemaUpdateElement', { ...elementRef.current, definition: state }),
      [builderHandler]
    ),
    500
  );

  const handleChange = useCallback(
    (key: string, value: string | boolean | number | object, isDefinition = false) => {
      if (isDefinition) {
        setTempDefinition((state: Element['definition']) => ({ ...state, [key]: value }));
      } else {
        setTempAttributes((state: Element['attributes']) => ({ ...state, [key]: value }));
      }
    },
    [setTempAttributes, setTempDefinition]
  );

  const getIdRefConflict = useCallback(
    (idRef: string) => idRefConflict(getSchemaFlat(), idRef, elementSelected),
    [getSchemaFlat, elementSelected]
  );

  const handleUpdateIdRef = useCallback(
    (idRef: string) => builderHandler('schemaUpdateElement', { ...elementRef.current, idRef: idRef || undefined }),
    [builderHandler]
  );

  const handleChangeBinding = useCallback(
    (bindings: Element['definition']['bindings']) => {
      if (!element) {
        return;
      }

      const { definition } = element;
      builderHandler('schemaUpdateElement', { ...element, definition: { ...definition, bindings } });
    },
    [builderHandler, element]
  );

  const handleChangeInteractions = useCallback(
    (interactions: Element['definition']['interactions']) => {
      if (!element) {
        return;
      }

      const { definition } = element;
      builderHandler('schemaUpdateElement', {
        ...element,
        definition: { ...definition, interactions }
      });
    },
    [builderHandler, element]
  );

  if (!element) {
    return (
      <div className="m-3 self-stretch rounded-sm border-2 border-dashed border-gray-300 p-3 text-center text-zinc-600 dark:border-zinc-600 dark:text-zinc-400">
        Click on a component to select it
      </div>
    );
  }

  const {
    definition: { type, bindings, interactions }
  } = element;

  return (
    <div className={clsx('mt-2 flex min-w-0 grow flex-col gap-2', { [`element-${type}`]: type })}>
      <BuilderBreadcrumb limit={4} />
      <ToolsList onSelect={handleClickListItems} selected={selected} />
      <div className="flex grow basis-0 flex-col overflow-y-auto">
        {selected === 'style' && (
          <StyleInspector
            displayMode={displayMode}
            selectors={selectors}
            value={selector}
            mode="element"
            element={element}
            componentType={element.definition.type}
            styleSelectors={tempDefinition.styleSelectors}
            styleSelectorsAvailables={styleSelectorsAvailables}
            onChange={setSelector}
          />
        )}
        {selected === 'settings' && (
          <div className="flex grow basis-0 flex-col gap-2 px-2">
            <ElementDefinitionSettings
              key={elementSelected}
              definition={tempDefinition}
              idRef={element.idRef}
              getIdRefConflict={getIdRefConflict}
              onUpdate={handleChange}
              onUpdateRef={handleUpdateIdRef}
            />
            <ElementSettings attributes={tempAttributes} id={elementSelected} type={type} handleChange={handleChange} />
          </div>
        )}
        {selected === 'bindings' && (
          <DataSourceBinding
            onChange={handleChangeBinding}
            id={elementSelected}
            bindings={bindings}
            element={element}
          />
        )}
        {selected === 'interactions' && (
          <Interactions idRef={element.idRef} interactions={interactions} onChange={handleChangeInteractions} />
        )}
      </div>
    </div>
  );
};

export default BuilderElementTools;
