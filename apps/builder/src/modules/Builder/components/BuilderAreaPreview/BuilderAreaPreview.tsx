/* eslint-disable react-hooks/static-components */

import ContainerFrame from '@plitzi/plitzi-ui/ContainerFrame';
import { ContainerRootContext } from '@plitzi/plitzi-ui/ContainerRoot';
import { get } from '@plitzi/plitzi-ui/helpers';
import { QueryBuilderEvaluator } from '@plitzi/plitzi-ui/QueryBuilder';
import clsx from 'clsx';
import { useCallback, use, useMemo } from 'react';

import GlobalSources from '@plitzi/sdk-elements/dataSource/GlobalSources';
import EventBridgeContext from '@plitzi/sdk-event-bridge/EventBridgeContext';
import InteractionsContext from '@plitzi/sdk-interactions/InteractionsContext';
import NavigationContext from '@plitzi/sdk-navigation/NavigationContext';
import { createStoreHook } from '@plitzi/nexus/createStore';
import PluginsContext from '@plitzi/sdk-plugins/PluginsContext';
import BuilderContext from '@plitzi/sdk-shared/builder/contexts/BuilderContext';
import CollectionContext from '@plitzi/sdk-shared/collections/CollectionContext';
import ComponentContext from '@plitzi/sdk-shared/elements/ComponentContext';
import { PlitziServiceProvider } from '@plitzi/sdk-shared/hooks/usePlitziServiceContext';
import NetworkContext from '@plitzi/sdk-shared/network/NetworkContext';
import SegmentsContext from '@plitzi/sdk-shared/segments/SegmentsContext';
import StateManagerContext from '@plitzi/sdk-state/StateManagerContext';
import processCssTokens from '@plitzi/sdk-style/helpers/processCssTokens';
import { schemaVariablesToCss } from '@plitzi/sdk-variables/VariablesHelper';
import AppContext from '@pmodules/App/AppContext';
import InteractionsBuilderContextProvider from '@pmodules/Interactions/InteractionsBuilderContextProvider';

// eslint-disable-next-line
// @ts-ignore
import styleFrame from '../../../Builder/Assets/index-iframe.scss?inline';

import type { BuilderState } from '@plitzi/sdk-shared';

export type BuilderAreaPreviewProps = {
  id?: string;
  className?: string;
  previewMode?: boolean;
};

const BuilderAreaPreview = ({ id = '', className = '', previewMode = false }: BuilderAreaPreviewProps) => {
  const { routeParams, queryParams, hostname } = use(NavigationContext);
  const { environment } = use(NetworkContext);
  const { rootRef } = use(ContainerRootContext);
  const { displayBorderComponents } = use(AppContext);
  const { theme } = use(BuilderContext);
  const { useStore } = createStoreHook<BuilderState>();
  const [[settings, variables, element, styleCache]] = useStore(
    ['schema.settings', 'schema.variables', `schema.flat.${id}`, 'style.cache'],
    { defaultValue: [undefined, undefined, undefined, ''] }
  );

  const getWindow = useCallback(() => {
    if (typeof window !== 'undefined') {
      return window;
    }

    // @todo: Hmm what to put here
    return { innerWidth: 1440, innerHeight: 900 } as Window;
  }, []);

  const plitziContextValue = useMemo(
    () => ({
      settings: { ...settings, previewMode, theme },
      root: { baseElementId: id },
      utils: { getWindow, rootRef },
      customContexts: {},
      contexts: {
        CollectionContext,
        ComponentContext,
        PluginsContext,
        NetworkContext,
        NavigationContext,
        StateManagerContext,
        InteractionsContext,
        SegmentsContext,
        EventBridgeContext
      }
    }),
    [previewMode, settings, theme, id, getWindow, rootRef]
  );

  const whenData = useMemo(
    () => ({ routeParams, queryParams, hostname, environment }),
    [routeParams, queryParams, hostname, environment]
  );

  const variablesParsed = useMemo(() => {
    if (!variables) {
      return {};
    }

    return variables.reduce((acum, variable) => {
      const { name, value, subValues } = variable;
      if (!Array.isArray(subValues) || subValues.length === 0) {
        return { ...acum, [name]: value };
      }

      const subValue = subValues.find(subValue => QueryBuilderEvaluator(subValue.when, whenData));
      if (subValue) {
        return { ...acum, [name]: subValue.value };
      }

      return { ...acum, [name]: value };
    }, {});
  }, [variables, whenData]);

  const css = useMemo(() => {
    const cssVariables = schemaVariablesToCss(variablesParsed);
    const cacheParsed = processCssTokens(styleCache, variablesParsed);

    return `:root{${cssVariables}}\n${styleFrame}\n@layer plitzi-builder-runtime{${cacheParsed}\n${settings?.customCss ?? ''}}`;
  }, [settings?.customCss, styleCache, variablesParsed]);

  const { components } = use(ComponentContext);
  const Plugin = useMemo(() => {
    if (!element) {
      return undefined;
    }

    const PluginNode = get(components.current, get(element, 'definition.type', ''), undefined);
    if (!PluginNode) {
      return undefined;
    }

    return <PluginNode internalProps={{ id, rootId: id }} />;
  }, [components, element, id]);

  return (
    <ContainerFrame
      className={clsx('builder-area flex', className)}
      css={css}
      style={{ colorScheme: theme === 'system' ? 'light' : theme }}
    >
      <PlitziServiceProvider value={plitziContextValue}>
        <GlobalSources>
          <InteractionsBuilderContextProvider>
            <div
              className={clsx('builder-iframe', {
                'builder--display-component-border display-component-border--black':
                  displayBorderComponents === 'black',
                'builder--display-component-border display-component-border--white': displayBorderComponents === 'white'
              })}
              style={{ width: '100%', display: 'flex', height: '100%' }}
            >
              {Plugin}
            </div>
          </InteractionsBuilderContextProvider>
        </GlobalSources>
      </PlitziServiceProvider>
    </ContainerFrame>
  );
};

export default BuilderAreaPreview;
