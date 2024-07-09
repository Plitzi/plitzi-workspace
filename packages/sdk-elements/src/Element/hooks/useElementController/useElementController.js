// Packages
import React, { use, useMemo } from 'react';
import get from 'lodash/get';

// Monorepo
import usePlitziServiceContext from '@plitzi/sdk-shared/usePlitziServiceContext';
import useEventBridge from '@plitzi/sdk-event-bridge/hooks/useEventBridge';
import { EventBridgeModuleTypes } from '@plitzi/sdk-event-bridge/EventBridgeHelper';

// Relatives
import useInternalProps from '../useInternalProps';
import useInternalItems from '../useInternalItems';
import useInternalClassName from '../useInternalClassName';
import useElementProps from '../useElementProps';

/**
 * @param {object} internalProps
 * @param {{
 *   plitziCustomComponent: boolean;
 *   children: React.ReactNode;
 *   className: string;
 * }} props
 * @returns {React.ReactElement}
 */
const useElementController = (internalProps, { plitziCustomComponent, children, className }) => {
  const {
    settings: { previewMode },
    root: { baseElementId },
    contexts: { SchemaContext, DataSourceContext, EventBridgeContext }
  } = usePlitziServiceContext();
  const { useDataSource } = use(DataSourceContext);
  const { schema } = use(SchemaContext);
  const { id } = internalProps;
  const { prevSchema } = use(SchemaContext);
  const newSchema = useMemo(() => ({ schema: prevSchema }), [prevSchema]);
  const element = useElementProps(id, schema);

  const sourceFilter = useMemo(() => {
    const bindings = get(element, 'definition.bindings', {});
    if (!bindings) {
      return ['variables'];
    }

    const filter = Object.values(bindings)
      .flat()
      .reduce((acc, binding) => (binding?.source ? [...acc, binding.source] : acc), []);
    if (!filter.includes('variables')) {
      filter.push('variables');
    }

    return filter;
  }, [element?.definition]);

  const dataSource = useDataSource({ id, mode: 'read', sourceFilter });

  const { internalProps: internalPropsParsed } = useInternalProps({
    element,
    internalProps,
    plitziCustomComponent,
    dataSource,
    previewMode
  });
  const eventCallbacks = useMemo(
    () => ({ [`${id}_setState`]: internalPropsParsed.handleState }),
    [internalPropsParsed.handleState]
  );

  useEventBridge(EventBridgeModuleTypes.ELEMENT, eventCallbacks, {}, EventBridgeContext);

  return {
    internalProps: internalPropsParsed,
    children: useInternalItems({
      internalProps: internalPropsParsed,
      schema,
      children,
      SchemaContext,
      prevSchema,
      newSchema,
      previewMode
    }),
    className: useInternalClassName({ className, internalProps: internalPropsParsed, previewMode, baseElementId })
  };
};

export default useElementController;
