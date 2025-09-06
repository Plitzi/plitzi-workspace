import get from 'lodash/get';
import { use, useMemo } from 'react';

import useEventBridge from '@plitzi/sdk-event-bridge/hooks/useEventBridge';
import usePlitziServiceContext from '@plitzi/sdk-shared/hooks/usePlitziServiceContext';

import useElementProps from './useElementProps';
import useInternalClassName from './useInternalClassName';
import useInternalItems from './useInternalItems';
import useInternalProps from './useInternalProps';

import type { EventBridgeCallback, EventBridgeContextValue } from '@plitzi/sdk-event-bridge';
import type { Schema, InternalPropsSTG1 } from '@plitzi/sdk-shared';
import type { Context, ReactNode } from 'react';

const useElement = (
  internalProps: InternalPropsSTG1,
  {
    plitziCustomComponent,
    children,
    className
  }: { className?: string; children?: ReactNode; plitziCustomComponent?: boolean }
) => {
  const {
    settings: { previewMode },
    root: { baseElementId },
    contexts: { SchemaContext, DataSourceContext, EventBridgeContext }
  } = usePlitziServiceContext();
  const { useDataSource } = use(DataSourceContext);
  const { prevSchema, schema } = use(SchemaContext);
  const { id } = internalProps;
  const element = useElementProps(id, schema);

  const sourceFilter = useMemo(() => {
    const bindings = get(element, 'definition.bindings');
    if (!bindings) {
      return ['variables'];
    }

    const filter = Object.values(bindings)
      .flat()
      .reduce<string[]>((acc, binding) => (binding.source ? [...acc, binding.source] : acc), []);
    if (!filter.includes('variables')) {
      filter.push('variables');
    }

    return filter;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [element.definition]);

  const dataSource = useDataSource({ id, mode: 'read', sourceFilter });

  const { internalProps: internalPropsParsed } = useInternalProps({
    element,
    internalProps,
    plitziCustomComponent,
    dataSource,
    previewMode
  });
  const eventCallbacks = useMemo<Record<string, EventBridgeCallback>>(
    () => ({
      [`${id}_setState`]: internalPropsParsed.setElementState as EventBridgeCallback
    }),
    [id, internalPropsParsed.setElementState]
  );

  useEventBridge('element', eventCallbacks, {}, EventBridgeContext as Context<EventBridgeContextValue>);

  return {
    internalProps: internalPropsParsed,
    children: useInternalItems({
      internalProps: internalPropsParsed,
      schema,
      children,
      SchemaContext,
      prevSchema,
      newSchema: prevSchema as Schema,
      previewMode
    }),
    className: useInternalClassName({ className, internalProps: internalPropsParsed, previewMode, baseElementId })
  };
};

export default useElement;
