import { get } from '@plitzi/plitzi-ui/helpers';
import useStateDebounce from '@plitzi/plitzi-ui/hooks/useStateDebounce';
import useStorage from '@plitzi/plitzi-ui/hooks/useStorage';
import clsx from 'clsx';
import { use, useMemo, useCallback, useRef } from 'react';

import BuilderContext from '@plitzi/sdk-shared/builder/contexts/BuilderContext';
import BuilderSelectedContext from '@plitzi/sdk-shared/builder/contexts/BuilderSelectedContext';
import BuilderStyleContext from '@plitzi/sdk-shared/builder/contexts/BuilderStyleContext';
import ComponentContext from '@plitzi/sdk-shared/elements/ComponentContext';
import StyleInspector from '@plitzi/sdk-style/components/StyleInspector';
import DataSourceBinding from '@pmodules/DataSource/DataSourceBinding';
import Interactions from '@pmodules/Interactions/Interactions';

import BuilderBreadcrumb from '../BuilderBreadcrumb';
import ElementDefinitionSettings from './ElementDefinitionSettings';
import ElementSettings from './ElementSettings';
import useBuilderElement from '../../hooks/useBuilderElement';
import ToolsList from '../ToolsList';

import type { Element } from '@plitzi/sdk-shared';

export type BuilderElementToolsProps = {
  initialTab?: string;
};

const BuilderElementTools = ({ initialTab = 'style' }: BuilderElementToolsProps) => {
  const [selected, setSelected] = useStorage<string>('builder-state.elementTools.tabSelected', initialTab);
  const { builderHandler } = use(BuilderContext);
  const { selector, setSelector } = use(BuilderStyleContext);
  const { elementSelected } = use(BuilderSelectedContext);
  const element = useBuilderElement(elementSelected);
  const { componentDefinitions } = use(ComponentContext);
  const attributes = useMemo(() => get(element, 'attributes', {} as Element['attributes']), [element]);
  const definition = useMemo(() => get(element, 'definition', {} as Element['definition']), [element]);
  const elementRef = useRef(element);
  elementRef.current = element;

  const styleSelectorsAvailables = useMemo(
    () => Object.keys(get(componentDefinitions.current, `${element?.definition.type}.definition.styleSelectors`, {})),
    [componentDefinitions, element?.definition.type]
  );

  const handleClickListItems = useCallback((item: string) => setSelected(item), [setSelected]);

  const [tempAttributes, setTempAttributes] = useStateDebounce<Element['attributes']>(
    attributes,
    useCallback(
      (state: Element['attributes']) =>
        builderHandler('schemaUpdateElement', { ...elementRef.current, attributes: state }),
      [builderHandler]
    ),
    500
  );

  const [tempDefinition, setTempDefinition] = useStateDebounce<Element['definition']>(
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
      <div className="m-3 w-full self-start rounded-sm border-2 border-dashed border-gray-300 p-3 text-center">
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
          <div className="flex grow basis-0 flex-col px-2">
            <ElementDefinitionSettings definition={tempDefinition} onUpdate={handleChange} />
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
          <Interactions id={elementSelected} interactions={interactions} onChange={handleChangeInteractions} />
        )}
      </div>
    </div>
  );
};

export default BuilderElementTools;
