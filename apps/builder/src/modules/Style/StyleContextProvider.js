// Packages
import React, { useCallback, use, useEffect, useMemo, useRef } from 'react';
import get from 'lodash/get';
import useReducerWithMiddleware from '@plitzi/plitzi-ui-components/hooks/useReducerWithMiddleware';

// Monorepo
import useEventBridge from '@plitzi/sdk-event-bridge/hooks/useEventBridge';
import { EventBridgeModuleTypes } from '@plitzi/sdk-event-bridge/EventBridgeHelper';
import StyleContext from '@plitzi/sdk-style/StyleContext';
import { makeSelector } from '@plitzi/sdk-style/StyleHelper';

// Alias
import NetworkContext from '@pmodules/Network/NetworkContext';
import NetworkInternalContext from '@pmodules/Network/contexts/NetworkInternalContext';
import { SubscriptionEventTypes } from '@pmodules/Network/helpers/EventTypes';
import QueueContext from '@pmodules/Queue/QueueContext';
import UndoableContext from '@pmodules/Undoable/UndoableContext';

// Relatives
import StyleReducer, { StyleActions } from './StyleReducer';

export const STYLE_TYPE_NORMAL = 'normal';
export const STYLE_TYPE_PARTIAL = 'partial';
export const STYLE_TYPE_TEMPLATE = 'template';

/**
 * @param {{
 *   children: React.ReactNode;
 *   style?: Record<string, any>;
 *   includeSubscriptions?: boolean;
 *   type?: 'normal' | 'partial' | 'template';
 * }} props
 * @returns {React.ReactElement}
 */
const StyleContextProvider = props => {
  const { children, style: styleProp, includeSubscriptions = true, type = STYLE_TYPE_NORMAL } = props;
  const { subscriptionManager } = use(NetworkContext);
  const internalData = use(NetworkInternalContext);
  const stylePropMemo = useMemo(() => {
    if (styleProp) {
      return styleProp;
    }

    switch (type) {
      case STYLE_TYPE_NORMAL:
        return internalData.style;
      default:
        return { platform: { desktop: {}, tablet: {}, mobile: {} }, cache: '' };
    }
  }, [styleProp]);
  const { enqueueMiddleware } = use(QueueContext);
  const { undoableMiddleware } = use(UndoableContext);
  const middlewareMemo = useMemo(
    () => [
      { middleware: undoableMiddleware, filterCallback: action => !action.fromSubscriptions },
      { middleware: enqueueMiddleware, filterCallback: action => !action.fromSubscriptions }
    ],
    [undoableMiddleware]
  );
  const [style, dispatchStyle] = useReducerWithMiddleware(StyleReducer, stylePropMemo, middlewareMemo);
  const styleRef = useRef(style);
  styleRef.current = style;

  const styleUpdate = useCallback(
    (style, fromSubscriptions = false) => dispatchStyle({ type: StyleActions.STYLE_UPDATE, style, fromSubscriptions }),
    [dispatchStyle]
  );

  const styleAddSelector = useCallback(
    (displayMode, selector, type, path, value, fromSubscriptions = false) => {
      if (!selector) {
        selector = makeSelector(type);
      }

      dispatchStyle({
        type: StyleActions.STYLE_ADD_SELECTOR,
        displayMode,
        selector,
        selectorType: type,
        path,
        value,
        fromSubscriptions
      });
    },
    [dispatchStyle]
  );

  const styleUpdateSelector = useCallback(
    (displayMode, selector, type, path, value, fromSubscriptions = false) =>
      dispatchStyle({
        type: StyleActions.STYLE_UPDATE_SELECTOR,
        displayMode,
        selector,
        selectorType: type,
        path,
        value,
        fromSubscriptions
      }),
    [dispatchStyle]
  );

  const styleRemoveSelector = useCallback(
    (selector, fromSubscriptions = false) =>
      dispatchStyle({ type: StyleActions.STYLE_REMOVE_SELECTOR, selector, fromSubscriptions }),
    [dispatchStyle]
  );

  const styleAddTemplate = useCallback(
    (platform, fromSubscriptions = false) =>
      dispatchStyle({ type: StyleActions.STYLE_ADD_TEMPLATE, platform, fromSubscriptions }),
    [dispatchStyle]
  );

  useEffect(() => {
    if (subscriptionManager && includeSubscriptions) {
      subscriptionManager.subscribe('StyleUpdated', SubscriptionEventTypes.STYLE_UPDATED, {}, data => {
        const style = get(data, 'data.StyleUpdated', {});
        styleUpdate(style, true);
      });

      subscriptionManager.subscribe('StyleAddSelector', SubscriptionEventTypes.STYLE_ADD_SELECTOR, {}, data => {
        const { displayMode, selector, type, path, style } = get(data, 'data.StyleAddSelector', {});
        styleAddSelector(displayMode, selector, type, path, style, true);
      });

      subscriptionManager.subscribe('StyleUpdateSelector', SubscriptionEventTypes.STYLE_UPDATE_SELECTOR, {}, data => {
        const { displayMode, selector, type, path, style } = get(data, 'data.StyleUpdateSelector', {});
        styleUpdateSelector(displayMode, selector, type, path, style, true);
      });

      subscriptionManager.subscribe('StyleRemoveSelector', SubscriptionEventTypes.STYLE_REMOVE_SELECTOR, {}, data => {
        const { selector } = get(data, 'data.StyleRemoveSelector', {});
        styleRemoveSelector(selector, true);
      });
    }
  }, [subscriptionManager, includeSubscriptions]);

  const styleContextMemo = useMemo(() => ({ style }), [style]);

  const events = useMemo(
    () => ({ styleUpdate, styleAddSelector, styleUpdateSelector, styleRemoveSelector, styleAddTemplate }),
    [styleUpdate, styleAddSelector, styleUpdateSelector, styleRemoveSelector, styleAddTemplate]
  );

  useEventBridge(EventBridgeModuleTypes.MAIN, events);

  return <StyleContext.Provider value={styleContextMemo}>{children}</StyleContext.Provider>;
};

export default StyleContextProvider;
