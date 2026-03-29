import { get, omit } from '@plitzi/plitzi-ui/helpers';
import useValueMemo from '@plitzi/plitzi-ui/hooks/useValueMemo';
import { use, useMemo } from 'react';

import getBindingsDetails from '@plitzi/sdk-data-source/helpers/getBindingsDetails';
import { processTwig, hasValidToken } from '@plitzi/sdk-shared/helpers/twigWrapper';
import SchemaContext from '@plitzi/sdk-shared/schema/SchemaContext';

import useElementDataSource from './useElementDataSource';
import useElementState from './useElementState';
import useInternalItems from './useInternalItems';
import parseStyleSelectors from '../helpers/parseStyleSelectors';

import type { RuleValue } from '@plitzi/plitzi-ui/QueryBuilder';
import type { Element, InternalPropsSTG1, Schema } from '@plitzi/sdk-shared';
import type { ReactNode } from 'react';

// Methods

const getProps = (
  element: Element,
  internalProps: InternalPropsSTG1,
  dataSource = {} as Record<string, unknown>,
  state = {} as Record<string, unknown>
) => {
  let style: Record<string, string> | undefined = undefined;
  let { attributes, definition } = element;
  const { rootId, plitziElementLayout } = internalProps;
  // Attribute injection, for example custom element (concat custom props + settings)
  if (internalProps.attributes) {
    attributes = { ...attributes, ...internalProps.attributes };
  }

  // Data Sources
  if (Object.keys(dataSource).length > 0) {
    const bindingData = getBindingsDetails(dataSource as Record<string, RuleValue>, { ...element, attributes }, style);
    ({ attributes, definition, style } = bindingData);
  }

  // Variables
  const { variables } = dataSource;
  if (variables && Object.keys(variables).length > 0) {
    attributes = Object.keys(attributes).reduce((acum, key) => {
      if (typeof attributes[key] === 'string' && hasValidToken(attributes[key])) {
        return { ...acum, [key]: processTwig(attributes[key], variables as Record<string, unknown>, true) };
      }

      return { ...acum, [key]: attributes[key] };
    }, {});
  }

  // State
  attributes = { ...attributes, ...omit(state, ['visibility', 'styleSelectors']) };
  definition = {
    ...definition,
    styleSelectors: {
      ...definition.styleSelectors,
      ...definition.initialState?.styleSelectors,
      ...(state.styleSelectors ?? {})
    }
  };

  // StyleSelectors now will include the component class
  if (definition.initialState?.styleVariant) {
    definition.styleSelectors = parseStyleSelectors(definition);
  }

  return {
    ...internalProps,
    rootId: get(plitziElementLayout, 'rootId', rootId),
    attributes: {
      ...attributes,
      ...omit(internalProps, ['id', 'rootId', 'attributes', 'definition', 'plitziElementLayout'])
    },
    definition,
    elementState: { ...definition.initialState, ...state },
    style
  };
};

export type UseElementInternalProps = {
  children?: ReactNode;
  internalProps: InternalPropsSTG1;
  previewMode?: boolean;
  baseElementId?: string;
};

const useElementInternal = ({
  children,
  internalProps,
  previewMode = false,
  baseElementId
}: UseElementInternalProps) => {
  const { prevSchema, schema } = use(SchemaContext);
  const { id } = internalProps;
  const element = useValueMemo(id ? schema.flat[id] : undefined);
  if (!element) {
    throw new Error(`Element ${id} not found, Page ${baseElementId}`);
  }

  const { state, setElementState } = useElementState({ bindings: element.definition.bindings, previewMode });
  const dataSource = useElementDataSource({ id, bindings: element.definition.bindings });

  const internalPropsParsed = useMemo(
    () => ({ ...getProps(element, internalProps, dataSource, state), setElementState }),
    [element, internalProps, dataSource, state, setElementState]
  );

  return {
    internalProps: internalPropsParsed,
    customProps: omit(internalPropsParsed, [
      'id',
      'rootId',
      'plitziElementLayout',
      'attributes',
      'definition',
      'style',
      'elementState',
      'setElementState'
    ]),
    children: useInternalItems({
      id,
      definition: internalPropsParsed.definition,
      plitziElementLayout: internalPropsParsed.plitziElementLayout,
      schema,
      children,
      SchemaContext,
      prevSchema,
      newSchema: prevSchema as Schema,
      previewMode
    })
  };
};

export default useElementInternal;
