import useValueMemo from '@plitzi/plitzi-ui/hooks/useValueMemo';
import { use, useMemo } from 'react';

import useEventBridge from '@plitzi/sdk-event-bridge/hooks/useEventBridge';
import usePlitziServiceContext from '@plitzi/sdk-shared/hooks/usePlitziServiceContext';

import useInternalClassName from './useInternalClassName';
import useInternalItems from './useInternalItems';
import useInternalProps from './useInternalProps';

import type { EventBridgeCallback } from '@plitzi/sdk-event-bridge';
import type { Schema, InternalPropsSTG1, Element } from '@plitzi/sdk-shared';
import type { ReactNode } from 'react';

const useElement = (
  internalProps: InternalPropsSTG1,
  {
    plitziCustomComponent = false,
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
  const element = useValueMemo<Element | undefined>(schema.flat[id]);
  if (!element) {
    throw new Error(`Element ${id} not found, Page ${baseElementId}`);
  }

  const sourceFilter = useMemo(() => {
    const bindings = element.definition.bindings ?? {};
    const filter = Object.values(bindings)
      .flat()
      .reduce<string[]>((acc, binding) => (binding.source ? [...acc, binding.source] : acc), []);
    if (filter.length === 0 || !filter.includes('variables')) {
      filter.push('variables');
    }

    return filter;
  }, [element.definition.bindings]);

  const dataSource = useDataSource({ id, mode: 'read', sourceFilter });

  const { internalProps: internalPropsParsed } = useInternalProps({
    element,
    internalProps,
    plitziCustomComponent,
    dataSource,
    previewMode
  });
  const eventCallbacks = useMemo<Record<string, EventBridgeCallback>>(
    () => ({ [`${id}_setState`]: internalPropsParsed.setElementState }),
    [id, internalPropsParsed.setElementState]
  );

  useEventBridge('element', eventCallbacks, {}, EventBridgeContext);

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
