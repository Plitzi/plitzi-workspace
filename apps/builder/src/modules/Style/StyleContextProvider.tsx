import useReducerWithMiddleware from '@plitzi/plitzi-ui/hooks/useReducerWithMiddleware';
import get from 'lodash/get';
import React, { useCallback, use, useEffect, useMemo, useRef } from 'react';

import useEventBridge from '@plitzi/sdk-event-bridge/hooks/useEventBridge';
import NetworkContext from '@plitzi/sdk-shared/network/NetworkContext';
import StyleContext from '@plitzi/sdk-style/StyleContext';
import { makeSelector } from '@plitzi/sdk-style/StyleHelper';
import NetworkInternalContext from '@pmodules/Network/contexts/NetworkInternalContext';
import QueueContext from '@pmodules/Queue/QueueContext';
import UndoableContext from '@pmodules/Undoable/UndoableContext';

import StyleReducer, { StyleActions } from './StyleReducer';

import type { StyleReducerActions } from './StyleReducer';
import type { ReducerMiddlewareCallback } from '@plitzi/plitzi-ui/hooks/useReducerWithMiddleware';
import type { BuilderNetworkContextValue, DisplayMode, Style, StyleItem, TagType } from '@plitzi/sdk-shared';

export type StyleContextProviderProps = {
  children: React.ReactNode;
  style?: Style;
  includeSubscriptions?: boolean;
  type?: 'normal' | 'partial' | 'template';
};

const StyleContextProvider = ({
  children,
  style: styleProp,
  includeSubscriptions = true,
  type = 'normal'
}: StyleContextProviderProps) => {
  const { subscriptionManager } = use(NetworkContext) as BuilderNetworkContextValue;
  const internalData = use(NetworkInternalContext);
  const stylePropMemo = useMemo(() => {
    if (styleProp) {
      return styleProp;
    }

    switch (type) {
      case 'normal':
        return internalData.style;
      default:
        return { variables: {}, platform: { desktop: {}, tablet: {}, mobile: {} }, cache: '' };
    }
  }, [internalData.style, styleProp, type]);
  const { enqueueMiddleware } = use(QueueContext);
  const { undoableMiddleware } = use(UndoableContext);
  const [style, dispatchStyle] = useReducerWithMiddleware(StyleReducer, stylePropMemo, [
    {
      middleware: undoableMiddleware as ReducerMiddlewareCallback<Style, [action: StyleReducerActions]>,
      filterCallback: action => !action.fromSubscriptions
    },
    {
      middleware: enqueueMiddleware as ReducerMiddlewareCallback<Style, [action: StyleReducerActions]>,
      filterCallback: action => !action.fromSubscriptions
    }
  ]);
  const styleRef = useRef<Style>(style);
  styleRef.current = style;

  const styleUpdate = useCallback(
    (style: Style, fromSubscriptions = false) =>
      dispatchStyle({ type: StyleActions.STYLE_UPDATE, style, fromSubscriptions }),
    [dispatchStyle]
  );

  const styleAddSelector = useCallback(
    (
      displayMode: DisplayMode,
      selector: string,
      type: TagType,
      path: string,
      value: StyleItem['attributes'],
      fromSubscriptions = false
    ) => {
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
    (
      displayMode: DisplayMode,
      selector: string,
      type: TagType,
      path: string,
      value: StyleItem['attributes'],
      fromSubscriptions = false
    ) =>
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
    (selector: string, fromSubscriptions = false) =>
      dispatchStyle({ type: StyleActions.STYLE_REMOVE_SELECTOR, selector, fromSubscriptions }),
    [dispatchStyle]
  );

  const styleAddVariable = useCallback(
    (variable: string, value: string, fromSubscriptions = false) =>
      dispatchStyle({ type: StyleActions.STYLE_ADD_VARIABLE, variable, value, fromSubscriptions }),
    [dispatchStyle]
  );

  const styleUpdateVariable = useCallback(
    (variable: string, value: string, fromSubscriptions = false) =>
      dispatchStyle({ type: StyleActions.STYLE_UPDATE_VARIABLE, variable, value, fromSubscriptions }),
    [dispatchStyle]
  );

  const styleRemoveVariable = useCallback(
    (variable: string, fromSubscriptions = false) =>
      dispatchStyle({ type: StyleActions.STYLE_REMOVE_VARIABLE, variable, fromSubscriptions }),
    [dispatchStyle]
  );

  const styleAddTemplate = useCallback(
    (platform: Style['platform'], fromSubscriptions = false) =>
      dispatchStyle({ type: StyleActions.STYLE_ADD_TEMPLATE, platform, fromSubscriptions }),
    [dispatchStyle]
  );

  useEffect(() => {
    if (includeSubscriptions) {
      subscriptionManager.subscribe('StyleUpdated', {}, data => {
        const style = get(data, 'data.StyleUpdated', {}) as Style;
        styleUpdate(style, true);
      });

      subscriptionManager.subscribe('StyleAddSelector', {}, data => {
        const { displayMode, selector, type, path, style } = get(data, 'data.StyleAddSelector', {}) as {
          displayMode: DisplayMode;
          selector: string;
          path: string;
          type: TagType;
          style: StyleItem['attributes'];
          fromSubscriptions?: boolean;
        };
        styleAddSelector(displayMode, selector, type, path, style, true);
      });

      subscriptionManager.subscribe('StyleUpdateSelector', {}, data => {
        const { displayMode, selector, type, path, style } = get(data, 'data.StyleUpdateSelector', {}) as {
          displayMode: DisplayMode;
          selector: string;
          path: string;
          type: TagType;
          style: StyleItem['attributes'];
          fromSubscriptions?: boolean;
        };
        styleUpdateSelector(displayMode, selector, type, path, style, true);
      });

      subscriptionManager.subscribe('StyleRemoveSelector', {}, data => {
        const { selector } = get(data, 'data.StyleRemoveSelector', {}) as { selector: string };
        styleRemoveSelector(selector, true);
      });

      subscriptionManager.subscribe('StyleAddVariable', {}, data => {
        const { variable, value } = get(data, 'data.StyleAddVariable', {}) as { variable: string; value: string };
        styleAddVariable(variable, value, true);
      });

      subscriptionManager.subscribe('StyleUpdateVariable', {}, data => {
        const { variable, value } = get(data, 'data.StyleUpdateVariable', {}) as { variable: string; value: string };
        styleUpdateVariable(variable, value, true);
      });

      subscriptionManager.subscribe('StyleRemoveVariable', {}, data => {
        const { variable } = get(data, 'data.StyleRemoveVariable', {}) as { variable: string };
        styleRemoveVariable(variable, true);
      });
    }

    return () => {
      if (includeSubscriptions) {
        subscriptionManager.unsubscribe([
          'StyleUpdated',
          'StyleAddSelector',
          'StyleUpdateSelector',
          'StyleRemoveSelector',
          'StyleAddVariable',
          'StyleUpdateVariable',
          'StyleRemoveVariable'
        ]);
      }
    };
  }, [
    subscriptionManager,
    includeSubscriptions,
    styleUpdate,
    styleAddSelector,
    styleUpdateSelector,
    styleRemoveSelector,
    styleAddVariable,
    styleUpdateVariable,
    styleRemoveVariable
  ]);

  const styleContextMemo = useMemo(() => ({ style }), [style]);

  const events = useMemo(
    () => ({
      styleUpdate,
      styleAddSelector,
      styleUpdateSelector,
      styleRemoveSelector,
      styleAddVariable,
      styleUpdateVariable,
      styleRemoveVariable,
      styleAddTemplate
    }),
    [
      styleUpdate,
      styleAddSelector,
      styleUpdateSelector,
      styleRemoveSelector,
      styleAddVariable,
      styleUpdateVariable,
      styleRemoveVariable,
      styleAddTemplate
    ]
  );

  useEventBridge('main', events);

  return <StyleContext value={styleContextMemo}>{children}</StyleContext>;
};

export default StyleContextProvider;
