// Packages
import React, { forwardRef, useCallback, useContext, useMemo, useRef } from 'react';
import PropTypes from 'prop-types';
import get from 'lodash/get';

// Monorepo
import { emptyObject } from '@plitzi/sdk-shared/utils';

// Relatives
import usePlitziServiceContext from '../../services/hooks/usePlitziServiceContext';
import { nativeEventsList } from './helpers/elementUtils';

const interactionBasicTriggers = { onClick: { title: 'On Click', preview: {}, params: {} } };

const RootElement = forwardRef((props, ref) => {
  const {
    children,
    tag: Tag = 'div',
    className = '',
    interactionTriggers = emptyObject,
    interactionCallbacks = emptyObject,
    internalProps,
    ...otherProps
  } = props;
  const { id, rootId, style, definition, interactions, interactionsBasicCallbacks } = internalProps;
  const plitziContextData = usePlitziServiceContext();
  const previewMode = get(plitziContextData, 'settings.previewMode', true);
  const InteractionsContext = get(plitziContextData, 'contexts.InteractionsContext');
  const DataSourceContext = get(plitziContextData, 'contexts.DataSourceContext');
  const baseElementId = get(plitziContextData, 'root.baseElementId');
  if (!Tag || !internalProps) {
    console.error(id, 'One of these parameters [tag, ref, internalProps] are missing', Tag, ref, internalProps);

    return undefined;
  }

  const params = useMemo(() => {
    if (previewMode || !definition?.type || rootId !== baseElementId) {
      return {};
    }

    return {
      'data-id': id,
      'data-root-id': rootId,
      'data-type': definition?.type ?? 'unknown',
      'data-root-render-element': true
    };
  }, [id, rootId, definition, previewMode, baseElementId]);

  if (!InteractionsContext) {
    return (
      <Tag ref={ref} style={style} className={className} {...otherProps} {...params}>
        {children}
      </Tag>
    );
  }

  const { interactionsManager, useInteractions } = useContext(InteractionsContext);
  const processEvent = useCallback(
    (e, id, actionName, originalCallback) => {
      e.stopPropagation();
      if (originalCallback) {
        // If otherProps contains the same event, hook it
        originalCallback(e);
      }

      // Interactions Code here
      e.preventDefault();
      interactionsManager.interactionTrigger(id, actionName, { event: e });
    },
    [interactionsManager]
  );

  const eventsAttached = useMemo(() => {
    if (!previewMode || !interactions) {
      return {};
    }

    return Object.values(interactions)
      .filter(node => node.type === 'trigger' && node.action && nativeEventsList.includes(node.action) && node.enabled)
      .reduce(
        (acum, node) => ({ ...acum, [node.action]: e => processEvent(e, id, node.action, otherProps[node.action]) }),
        {}
      );
  }, [id, interactions, otherProps, previewMode, processEvent]);

  const { useDataSource } = useContext(DataSourceContext);
  const dataSource = useDataSource({ id, mode: 'read' });
  const dataSourceContextRef = useRef({});
  dataSourceContextRef.current = dataSource;

  const getAdditionalParams = useCallback(() => ({ dataSource: dataSourceContextRef.current }), [dataSourceContextRef]);

  const interactionTriggersMemo = useMemo(
    () => ({ ...interactionBasicTriggers, ...interactionTriggers }),
    [interactionTriggers]
  );

  const interactionCallbacksMemo = useMemo(
    () => ({ ...interactionCallbacks, ...interactionsBasicCallbacks }),
    [interactionCallbacks, interactionsBasicCallbacks]
  );

  useInteractions({
    id,
    interactions: internalProps?.interactions,
    triggers: interactionTriggersMemo,
    callbacks: interactionCallbacksMemo,
    getAdditionalParams
  });

  return (
    <Tag ref={ref} style={style} className={className} {...otherProps} {...params} {...eventsAttached}>
      {children}
    </Tag>
  );
});

RootElement.propTypes = {
  children: PropTypes.node,
  internalProps: PropTypes.object,
  className: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
  interactionTriggers: PropTypes.object,
  interactionCallbacks: PropTypes.object,
  tag: PropTypes.string
};

export default RootElement;

export { RootElement };
