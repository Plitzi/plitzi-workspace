import { get } from '@plitzi/plitzi-ui/helpers';
import useReducerWithMiddleware from '@plitzi/plitzi-ui/hooks/useReducerWithMiddleware';
import React, { useCallback, use, useEffect, useMemo, useRef } from 'react';

import useEventBridge from '@plitzi/sdk-event-bridge/hooks/useEventBridge';
import NetworkContext from '@plitzi/sdk-shared/network/NetworkContext';
import { EMPTY_STYLE_SCHEMA } from '@plitzi/sdk-shared/style/styleConstants';
import StyleContext from '@plitzi/sdk-style/StyleContext';
import { makeSelector } from '@plitzi/sdk-style/StyleHelper';

import StyleReducer, { StyleActions } from './StyleReducer';

import type { StyleReducerActions } from './StyleReducer';
import type { ReducerMiddlewareCallback } from '@plitzi/plitzi-ui/hooks/useReducerWithMiddleware';
import type {
  BuilderQueriesMap,
  BuilderMutationsMap,
  BuilderSubscriptionsMap,
  BuilderNetworkContextValue,
  DisplayMode,
  Style,
  StyleItem,
  StyleVariableCategory,
  StyleVariableValue,
  TagType,
  StyleCategory
} from '@plitzi/sdk-shared';

export type BuilderStyleContextProviderProps = {
  children: React.ReactNode;
  style?: Style;
  includeSubscriptions?: boolean;
  middlewares?: ReducerMiddlewareCallback<Style, [action: StyleReducerActions]>[];
};

const BuilderStyleContextProvider = ({
  children,
  style: styleProp,
  includeSubscriptions = true,
  middlewares: middlewaresProp = []
}: BuilderStyleContextProviderProps) => {
  const { subscriptionManager } = use(NetworkContext) as BuilderNetworkContextValue<
    BuilderQueriesMap,
    BuilderMutationsMap,
    BuilderSubscriptionsMap
  >;
  const middlewares = useMemo(
    () =>
      middlewaresProp.map(middleware => ({
        middleware,
        filterCallback: (action: StyleReducerActions) => !action.fromSubscriptions
      })),
    [middlewaresProp]
  );
  const [style, dispatchStyle] = useReducerWithMiddleware(StyleReducer, styleProp ?? EMPTY_STYLE_SCHEMA, middlewares);
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
      path: StyleCategory | undefined,
      value: StyleItem['attributes'] | undefined,
      params: { componentType: string; styleSelector?: string },
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
        params,
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
      path: StyleCategory | undefined,
      value: StyleItem['attributes'] | undefined,
      params: { componentType: string; styleSelector?: string },
      fromSubscriptions = false
    ) =>
      dispatchStyle({
        type: StyleActions.STYLE_UPDATE_SELECTOR,
        displayMode,
        selector,
        selectorType: type,
        path,
        value,
        params,
        fromSubscriptions
      }),
    [dispatchStyle]
  );

  const styleRemoveSelector = useCallback(
    (displayMode: DisplayMode | undefined, selector: string, fromSubscriptions = false) =>
      dispatchStyle({ type: StyleActions.STYLE_REMOVE_SELECTOR, displayMode, selector, fromSubscriptions }),
    [dispatchStyle]
  );

  const styleAddSelectorVariable = useCallback(
    (
      displayMode: DisplayMode,
      selector: string,
      category: StyleVariableCategory,
      name: string,
      value: StyleVariableValue,
      fromSubscriptions = false
    ) => {
      dispatchStyle({
        type: StyleActions.STYLE_ADD_SELECTOR_VARIABLE,
        displayMode,
        selector,
        category,
        name,
        value,
        fromSubscriptions
      });
    },
    [dispatchStyle]
  );

  const styleUpdateSelectorVariable = useCallback(
    (
      displayMode: DisplayMode,
      selector: string,
      category: StyleVariableCategory,
      name: string,
      value: StyleVariableValue,
      fromSubscriptions = false
    ) => {
      dispatchStyle({
        type: StyleActions.STYLE_UPDATE_SELECTOR_VARIABLE,
        displayMode,
        selector,
        category,
        name,
        value,
        fromSubscriptions
      });
    },
    [dispatchStyle]
  );

  const styleRemoveSelectorVariable = useCallback(
    (
      displayMode: DisplayMode,
      selector: string,
      category: StyleVariableCategory,
      name: string,
      fromSubscriptions = false
    ) => {
      dispatchStyle({
        type: StyleActions.STYLE_REMOVE_SELECTOR_VARIABLE,
        displayMode,
        selector,
        category,
        name,
        fromSubscriptions
      });
    },
    [dispatchStyle]
  );

  const styleAddVariable = useCallback(
    (category: StyleVariableCategory, name: string, value: StyleVariableValue, fromSubscriptions = false) =>
      dispatchStyle({ type: StyleActions.STYLE_ADD_VARIABLE, category, name, value, fromSubscriptions }),
    [dispatchStyle]
  );

  const styleUpdateVariable = useCallback(
    (category: StyleVariableCategory, name: string, value: StyleVariableValue, fromSubscriptions = false) =>
      dispatchStyle({ type: StyleActions.STYLE_UPDATE_VARIABLE, category, name, value, fromSubscriptions }),
    [dispatchStyle]
  );

  const styleRemoveVariable = useCallback(
    (category: StyleVariableCategory, name: string, fromSubscriptions = false) =>
      dispatchStyle({ type: StyleActions.STYLE_REMOVE_VARIABLE, category, name, fromSubscriptions }),
    [dispatchStyle]
  );

  const styleAddTemplate = useCallback(
    (platform: Style['platform'], fromSubscriptions = false) =>
      dispatchStyle({ type: StyleActions.STYLE_ADD_TEMPLATE, platform, fromSubscriptions }),
    [dispatchStyle]
  );

  const styleUpdateSettings = useCallback(
    (path: string, value: string, fromSubscriptions = false) => {
      dispatchStyle({ type: StyleActions.STYLE_UPDATE_SETTINGS, path, value, fromSubscriptions });
    },
    [dispatchStyle]
  );

  useEffect(() => {
    if (includeSubscriptions) {
      subscriptionManager.subscribe('StyleUpdated', {}, data => {
        const style = get(data, 'data.StyleUpdated', {}) as BuilderSubscriptionsMap['StyleUpdated'];
        styleUpdate(style, true);
      });

      subscriptionManager.subscribe('StyleAddSelector', {}, data => {
        const { displayMode, selector, type, path, style, params } = get(
          data,
          'data.StyleAddSelector',
          {}
        ) as BuilderSubscriptionsMap['StyleAddSelector'];
        styleAddSelector(displayMode, selector, type, path, style, params, true);
      });

      subscriptionManager.subscribe('StyleUpdateSelector', {}, data => {
        const { displayMode, selector, type, path, style, params } = get(
          data,
          'data.StyleUpdateSelector',
          {}
        ) as BuilderSubscriptionsMap['StyleUpdateSelector'];
        styleUpdateSelector(displayMode, selector, type, path, style, params, true);
      });

      subscriptionManager.subscribe('StyleRemoveSelector', {}, data => {
        const { displayMode, selector } = get(
          data,
          'data.StyleRemoveSelector',
          {}
        ) as BuilderSubscriptionsMap['StyleRemoveSelector'];
        styleRemoveSelector(displayMode, selector, true);
      });

      subscriptionManager.subscribe('StyleAddSelectorVariable', {}, data => {
        const { displayMode, selector, category, name, value } = get(
          data,
          'data.StyleAddSelectorVariable',
          {}
        ) as BuilderSubscriptionsMap['StyleAddSelectorVariable'];
        styleAddSelectorVariable(displayMode, selector, category, name, value, true);
      });

      subscriptionManager.subscribe('StyleUpdateSelectorVariable', {}, data => {
        const { displayMode, selector, category, name, value } = get(
          data,
          'data.StyleUpdateSelectorVariable',
          {}
        ) as BuilderSubscriptionsMap['StyleUpdateSelectorVariable'];
        styleUpdateSelectorVariable(displayMode, selector, category, name, value, true);
      });

      subscriptionManager.subscribe('StyleRemoveSelectorVariable', {}, data => {
        const { displayMode, selector, category, name } = get(
          data,
          'data.StyleRemoveSelectorVariable',
          {}
        ) as BuilderSubscriptionsMap['StyleRemoveSelectorVariable'];
        styleRemoveSelectorVariable(displayMode, selector, category, name, true);
      });

      subscriptionManager.subscribe('StyleAddVariable', {}, data => {
        const { category, name, value } = get(
          data,
          'data.StyleAddVariable',
          {}
        ) as BuilderSubscriptionsMap['StyleAddVariable'];
        styleAddVariable(category, name, value, true);
      });

      subscriptionManager.subscribe('StyleUpdateVariable', {}, data => {
        const { category, name, value } = get(
          data,
          'data.StyleUpdateVariable',
          {}
        ) as BuilderSubscriptionsMap['StyleUpdateVariable'];
        styleUpdateVariable(category, name, value, true);
      });

      subscriptionManager.subscribe('StyleRemoveVariable', {}, data => {
        const { category, name } = get(
          data,
          'data.StyleRemoveVariable',
          {}
        ) as BuilderSubscriptionsMap['StyleRemoveVariable'];
        styleRemoveVariable(category, name, true);
      });

      subscriptionManager.subscribe('StyleUpdateSettings', {}, data => {
        const { path, value } = get(
          data,
          'data.StyleUpdateSettings',
          {}
        ) as BuilderSubscriptionsMap['StyleUpdateSettings'];
        styleUpdateSettings(path, value, true);
      });
    }

    return () => {
      if (includeSubscriptions) {
        subscriptionManager.unsubscribe([
          'StyleUpdated',
          'StyleAddSelector',
          'StyleUpdateSelector',
          'StyleRemoveSelector',
          'StyleAddSelectorVariable',
          'StyleUpdateSelectorVariable',
          'StyleRemoveSelectorVariable',
          'StyleAddVariable',
          'StyleUpdateVariable',
          'StyleRemoveVariable',
          'StyleUpdateSettings'
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
    styleAddSelectorVariable,
    styleUpdateSelectorVariable,
    styleRemoveSelectorVariable,
    styleAddVariable,
    styleUpdateVariable,
    styleRemoveVariable,
    styleUpdateSettings
  ]);

  const styleContextMemo = useMemo(() => ({ style }), [style]);

  const events = useMemo(
    () => ({
      styleUpdate,
      styleAddSelector,
      styleUpdateSelector,
      styleRemoveSelector,
      styleAddSelectorVariable,
      styleUpdateSelectorVariable,
      styleRemoveSelectorVariable,
      styleAddVariable,
      styleUpdateVariable,
      styleRemoveVariable,
      styleAddTemplate,
      styleUpdateSettings
    }),
    [
      styleUpdate,
      styleAddSelector,
      styleUpdateSelector,
      styleRemoveSelector,
      styleAddSelectorVariable,
      styleUpdateSelectorVariable,
      styleRemoveSelectorVariable,
      styleAddVariable,
      styleUpdateVariable,
      styleRemoveVariable,
      styleAddTemplate,
      styleUpdateSettings
    ]
  );

  useEventBridge('main', events);

  return <StyleContext value={styleContextMemo}>{children}</StyleContext>;
};

export default BuilderStyleContextProvider;
