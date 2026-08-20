import useReducerWithMiddleware from '@plitzi/plitzi-ui/hooks/useReducerWithMiddleware';
import React, { useCallback, use, useEffect, useMemo } from 'react';

import useEventBridge from '@plitzi/sdk-event-bridge/hooks/useEventBridge';
import NetworkContext from '@plitzi/sdk-shared/network/NetworkContext';
import { useCommonStoreSync } from '@plitzi/sdk-shared/store';
import { EMPTY_STYLE_SCHEMA } from '@plitzi/sdk-shared/style/styleConstants';

import StyleContext from './StyleContext';
import { makeSelector } from './StyleHelper';
import StyleReducer, { StyleActions } from './StyleReducer';

import type { StyleReducerActions } from './StyleReducer';
import type {
  ReducerFilterCallback,
  ReducerMiddlewareCallback
} from '@plitzi/plitzi-ui/hooks/useReducerWithMiddleware';
import type {
  BuilderQueriesMap,
  BuilderMutationsMap,
  SpaceEventMap,
  BuilderNetworkContextValue,
  DisplayMode,
  Style,
  StyleItem,
  StyleVariableCategory,
  StyleVariableValue,
  TagType,
  StyleCategory,
  StyleState
} from '@plitzi/sdk-shared';

/**
 * A middleware and what it is shown. The filter belongs to the caller, not here: a save queue must never see another
 * session's edit, and an undo history has to see it — it is how it learns its snapshots no longer describe the space.
 * This provider deciding for both is what silently taught the history to ignore them.
 */
export type BuilderStyleMiddleware = {
  middleware: ReducerMiddlewareCallback<Style, [action: StyleReducerActions]>;
  filterCallback?: ReducerFilterCallback<[action: StyleReducerActions]>;
};

export type BuilderStyleContextProviderProps = {
  children: React.ReactNode;
  style?: Style;
  includeSubscriptions?: boolean;
  middlewares?: BuilderStyleMiddleware[];
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
    SpaceEventMap
  >;
  const [style, dispatchStyle] = useReducerWithMiddleware(
    StyleReducer,
    styleProp ?? EMPTY_STYLE_SCHEMA,
    middlewaresProp
  );

  useCommonStoreSync('style', style);

  const styleUpdate = useCallback(
    (style: Partial<Style>, fromSubscriptions = false) =>
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
      params: { componentType?: string; styleSelector?: string; styleState?: StyleState; styleVariant?: string },
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
      path: StyleCategory | undefined,
      value: StyleItem['attributes'] | undefined,
      params: { componentType?: string; styleSelector: string; styleState?: StyleState; styleVariant?: string },
      fromSubscriptions = false
    ) =>
      dispatchStyle({
        type: StyleActions.STYLE_UPDATE_SELECTOR,
        displayMode,
        selector,
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

  const styleRemoveSelectors = useCallback(
    (displayMode: DisplayMode | undefined, selectors: string[], fromSubscriptions = false) =>
      dispatchStyle({ type: StyleActions.STYLE_REMOVE_SELECTORS, displayMode, selectors, fromSubscriptions }),
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
    if (!includeSubscriptions) {
      return undefined;
    }

    // A style edit publishes the parts a live builder re-applies, not a whole Style: the reducer merges them.
    subscriptionManager.subscribe('STYLE_UPDATED', style => styleUpdate(style, true));

    // Selectors
    subscriptionManager.subscribe('STYLE_ADD_SELECTOR', ({ displayMode, selector, type, path, style, params }) =>
      styleAddSelector(displayMode, selector, type, path, style, params, true)
    );
    subscriptionManager.subscribe('STYLE_UPDATE_SELECTOR', ({ displayMode, selector, path, style, params }) =>
      styleUpdateSelector(displayMode, selector, path, style, params, true)
    );
    subscriptionManager.subscribe('STYLE_REMOVE_SELECTOR', ({ displayMode, selector }) =>
      styleRemoveSelector(displayMode, selector, true)
    );
    subscriptionManager.subscribe('STYLE_REMOVE_SELECTORS', ({ displayMode, selectors }) =>
      styleRemoveSelectors(displayMode, selectors, true)
    );

    // Selector variables
    subscriptionManager.subscribe('STYLE_ADD_SELECTOR_VARIABLE', ({ displayMode, selector, category, name, value }) =>
      styleAddSelectorVariable(displayMode, selector, category, name, value, true)
    );
    subscriptionManager.subscribe(
      'STYLE_UPDATE_SELECTOR_VARIABLE',
      ({ displayMode, selector, category, name, value }) =>
        styleUpdateSelectorVariable(displayMode, selector, category, name, value, true)
    );
    subscriptionManager.subscribe('STYLE_REMOVE_SELECTOR_VARIABLE', ({ displayMode, selector, category, name }) =>
      styleRemoveSelectorVariable(displayMode, selector, category, name, true)
    );

    // Variables
    subscriptionManager.subscribe('STYLE_ADD_VARIABLE', ({ category, name, value }) =>
      styleAddVariable(category, name, value, true)
    );
    subscriptionManager.subscribe('STYLE_UPDATE_VARIABLE', ({ category, name, value }) =>
      styleUpdateVariable(category, name, value, true)
    );
    subscriptionManager.subscribe('STYLE_REMOVE_VARIABLE', ({ category, name }) =>
      styleRemoveVariable(category, name, true)
    );

    // Others
    subscriptionManager.subscribe('STYLE_UPDATE_SETTINGS', ({ path, value }) => styleUpdateSettings(path, value, true));

    return () =>
      subscriptionManager.unsubscribe(
        [
          'STYLE_UPDATED',
          'STYLE_ADD_SELECTOR',
          'STYLE_UPDATE_SELECTOR',
          'STYLE_REMOVE_SELECTOR',
          'STYLE_REMOVE_SELECTORS',
          'STYLE_ADD_SELECTOR_VARIABLE',
          'STYLE_UPDATE_SELECTOR_VARIABLE',
          'STYLE_REMOVE_SELECTOR_VARIABLE',
          'STYLE_ADD_VARIABLE',
          'STYLE_UPDATE_VARIABLE',
          'STYLE_REMOVE_VARIABLE',
          'STYLE_UPDATE_SETTINGS'
        ],
        true
      );
  }, [
    subscriptionManager,
    includeSubscriptions,
    styleUpdate,
    styleAddSelector,
    styleUpdateSelector,
    styleRemoveSelector,
    styleRemoveSelectors,
    styleAddSelectorVariable,
    styleUpdateSelectorVariable,
    styleRemoveSelectorVariable,
    styleAddVariable,
    styleUpdateVariable,
    styleRemoveVariable,
    styleUpdateSettings
  ]);

  const events = useMemo(
    () => ({
      styleUpdate,
      styleAddSelector,
      styleUpdateSelector,
      styleRemoveSelector,
      styleRemoveSelectors,
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
      styleRemoveSelectors,
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

  return <StyleContext value={events}>{children}</StyleContext>;
};

export default BuilderStyleContextProvider;
