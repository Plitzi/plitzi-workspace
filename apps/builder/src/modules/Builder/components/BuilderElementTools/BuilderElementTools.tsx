import useStateDebounce from '@plitzi/plitzi-ui/hooks/useStateDebounce';
import useStorage from '@plitzi/plitzi-ui/hooks/useStorage';
import classNames from 'classnames';
import get from 'lodash/get';
import { use, useMemo, useCallback, useRef } from 'react';

import BuilderContext from '@plitzi/sdk-shared/builder/contexts/BuilderContext';
import BuilderSelectedContext from '@plitzi/sdk-shared/builder/contexts/BuilderSelectedContext';
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
  const { elementSelected } = use(BuilderSelectedContext);
  const element = useBuilderElement(elementSelected);
  const attributes = useMemo(() => get(element, 'attributes', {} as Element['attributes']), [element]);
  const definition = useMemo(() => get(element, 'definition', {} as Element['definition']), [element]);
  const elementRef = useRef(element);
  elementRef.current = element;

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
    (key: string, value: string | boolean | number, isDefinition = false) => {
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
      const { definition } = element;
      builderHandler('schemaUpdateElement', { ...element, definition: { ...definition, bindings } });
    },
    [builderHandler, element]
  );

  const handleChangeInteractions = useCallback(
    (interactions: Element['definition']['interactions']) => {
      const { definition } = element;
      builderHandler('schemaUpdateElement', {
        ...element,
        definition: { ...definition, interactions }
      });
    },
    [builderHandler, element]
  );

  if (!(element as Element | undefined)) {
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
    <div className={classNames('flex flex-col grow min-w-0 gap-4 mt-2', { [`element-${type}`]: type })}>
      <BuilderBreadcrumb limit={4} />
      <ToolsList onSelect={handleClickListItems} selected={selected} />
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
