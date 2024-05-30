// Packages
import React, { use, useEffect, useMemo, useRef, useState } from 'react';
import get from 'lodash/get';

// Monorepo
import usePlitziServiceContext from '@plitzi/sdk-shared/usePlitziServiceContext';
import useEventBridge from '@plitzi/sdk-event-bridge/hooks/useEventBridge';
import { EventBridgeModuleTypes } from '@plitzi/sdk-event-bridge/EventBridgeHelper';

// Relatives
import ElementController from './helpers/ElementController';

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
  const [, setReRender] = useState(0);
  const { useDataSource } = use(DataSourceContext);
  const { schema } = use(SchemaContext);
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

  const { prevSchema } = use(SchemaContext);
  const newSchema = useMemo(() => ({ schema: prevSchema }), [prevSchema]);
  const { items } = get(element, 'definition', {});
  const itemsMemo = useMemo(
    () => instance.parseItems(schema, children, SchemaContext, prevSchema, newSchema),
    [children, prevSchema, newSchema, items, previewMode, plitziElementLayout]
  );

  // Others

  const initRef = useRef(false);
  useEffect(() => {
    if (initRef.current) {
      instance.initInteractions();
      setReRender(Date.now());
    } else {
      initRef.current = true;
    }
  }, [get(element, 'definition.label', id)]);

  return {
    internalProps: instance.internalProps,
    children: itemsMemo,
    className: instance.getClassName(className)
  };
};

export default useElementController;
