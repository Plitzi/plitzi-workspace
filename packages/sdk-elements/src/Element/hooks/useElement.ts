import useValueMemo from '@plitzi/plitzi-ui/hooks/useValueMemo';
import { use, useMemo } from 'react';

import SchemaContext from '@plitzi/sdk-schema/SchemaContext';
import useDataSource from '@plitzi/sdk-shared/dataSource/hooks/useDataSource';
import usePlitziServiceContext from '@plitzi/sdk-shared/hooks/usePlitziServiceContext';

import useInternalClassName from './useInternalClassName';
import useInternalItems from './useInternalItems';
import useInternalProps from './useInternalProps';

import type { Schema, InternalPropsSTG1, Element } from '@plitzi/sdk-shared';
import type { ReactNode } from 'react';

const useElement = (
  internalProps: InternalPropsSTG1,
  { children, className }: { className?: string; children?: ReactNode }
) => {
  const {
    settings: { previewMode },
    root: { baseElementId }
  } = usePlitziServiceContext();
  const { prevSchema, schema } = use(SchemaContext);
  const { id } = internalProps;
  const element = useValueMemo<Element | undefined>(id ? schema.flat[id] : undefined);
  if (!element) {
    throw new Error(`Element ${id} not found, Page ${baseElementId}`);
  }

  const sourceFilter = useMemo(() => {
    const filter = Object.values(element.definition.bindings ?? {})
      .flat()
      .reduce<string[]>((acc, binding) => (binding.source ? [...acc, binding.source] : acc), []);
    if (filter.length === 0 || !filter.includes('variables')) {
      filter.push('variables');
    }

    return filter;
  }, [element.definition.bindings]);

  const dataSource = useDataSource({ id, mode: 'read', sourceFilter });
  const { internalProps: internalPropsParsed } = useInternalProps({ element, internalProps, dataSource, previewMode });

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
