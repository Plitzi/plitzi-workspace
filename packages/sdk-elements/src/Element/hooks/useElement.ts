import useValueMemo from '@plitzi/plitzi-ui/hooks/useValueMemo';
import { use } from 'react';

import SchemaContext from '@plitzi/sdk-schema/SchemaContext';
import usePlitziServiceContext from '@plitzi/sdk-shared/hooks/usePlitziServiceContext';

import useElementDataSource from './useElementDataSource';
import useInternalItems from './useInternalItems';
import useInternalProps from './useInternalProps';

import type { Schema, InternalPropsSTG1, Element } from '@plitzi/sdk-shared';
import type { ReactNode } from 'react';

const useElement = (internalProps: InternalPropsSTG1, { children }: { children?: ReactNode }) => {
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

  const dataSource = useElementDataSource({ id, bindings: element.definition.bindings });
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
    })
  };
};

export default useElement;
