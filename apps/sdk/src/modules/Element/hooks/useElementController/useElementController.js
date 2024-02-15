// Packages
import { useContext, useMemo, useState } from 'react';
import get from 'lodash/get';

// Monorepo
import useEventBridge from '@repo/event-bridge/hooks/useEventBridge';
import { EventBridgeModuleTypes } from '@repo/event-bridge/EventBridgeHelper';

// Relatives
import usePlitziServiceContext from '../../../../services/hooks/usePlitziServiceContext';
import ElementController from './helpers/ElementController';

const useElementController = (internalProps, { plitziCustomComponent, children, className }) => {
  const {
    settings: { previewMode },
    root: { baseElementId },
    contexts: { SchemaContext, DataSourceContext, EventBridgeContext }
  } = usePlitziServiceContext();
  const [, setReRender] = useState(0);
  const { useDataSource } = useContext(DataSourceContext);
  const { schema } = useContext(SchemaContext);
  const { id, plitziElementLayout } = internalProps;
  const element = get(schema, `flat.${id}`);
  const dataSource = useDataSource({ id, mode: 'read' });
  const instance = useMemo(
    () =>
      new ElementController(setReRender, id, internalProps, schema, {
        isCustomComponent: plitziCustomComponent,
        previewMode,
        baseElementId
      }),
    [element, internalProps, previewMode]
  );

  useMemo(() => instance.parse(dataSource), [instance.parse, dataSource, instance.state]);

  const eventCallbacks = useMemo(() => ({ [`${id}_setState`]: instance.handleState }), [instance.handleState]);

  useEventBridge(EventBridgeModuleTypes.ELEMENT, eventCallbacks, {}, EventBridgeContext);

  // Items

  useMemo(() => {
    instance.refreshLayoutKeyIdentifier();
  }, [plitziElementLayout]);

  const { prevSchema } = useContext(SchemaContext);
  const newSchema = useMemo(() => ({ schema: prevSchema }), [prevSchema]);
  const { items } = get(element, 'definition', {});
  const itemsMemo = useMemo(
    () => instance.parseItems(schema, children, SchemaContext, prevSchema, newSchema),
    [children, prevSchema, newSchema, items, previewMode, plitziElementLayout]
  );

  return {
    internalProps: instance.internalProps,
    children: itemsMemo,
    className: instance.getClassName(className)
  };
};

export default useElementController;
