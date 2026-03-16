import ContainerFrame from '@plitzi/plitzi-ui/ContainerFrame';
import { ContainerRootContext } from '@plitzi/plitzi-ui/ContainerRoot';
import { get } from '@plitzi/plitzi-ui/helpers';
import clsx from 'clsx';
import { useCallback, use, useMemo } from 'react';

import DataSourceContextProvider from '@plitzi/sdk-data-source/DataSourceContextProvider';
import EventBridgeContext from '@plitzi/sdk-event-bridge/EventBridgeContext';
import InteractionsContext from '@plitzi/sdk-interactions/InteractionsContext';
import NavigationContext from '@plitzi/sdk-navigation/NavigationContext';
import PluginsContext from '@plitzi/sdk-plugins/PluginsContext';
import CollectionContext from '@plitzi/sdk-shared/collections/CollectionContext';
import DataSourceContext from '@plitzi/sdk-shared/dataSource/DataSourceContext';
import ComponentContext from '@plitzi/sdk-shared/elements/ComponentContext';
import { PlitziServiceProvider } from '@plitzi/sdk-shared/hooks/usePlitziServiceContext';
import NetworkContext from '@plitzi/sdk-shared/network/NetworkContext';
import SchemaContext from '@plitzi/sdk-shared/schema/SchemaContext';
import SegmentsContext from '@plitzi/sdk-shared/segments/SegmentsContext';
import StateManagerContext from '@plitzi/sdk-state/StateManagerContext';
import processCssTokens from '@plitzi/sdk-style/helpers/processCssTokens';
import StyleContext from '@plitzi/sdk-style/StyleContext';
import { schemaVariablesToCss } from '@plitzi/sdk-variables/VariablesHelper';
import AppContext from '@pmodules/App/AppContext';
import InteractionsBuilderContextProvider from '@pmodules/Interactions/InteractionsBuilderContextProvider';

// eslint-disable-next-line
// @ts-ignore
import styleFrame from '../../../Builder/Assets/index-iframe.scss?inline';

import type { Schema } from '@plitzi/sdk-shared';

export type BuilderAreaPreviewProps = {
  id?: string;
  className?: string;
  previewMode?: boolean;
  schema?: Schema;
  styleCache?: string;
  variables?: Record<string, string>;
};

const BuilderAreaPreview = ({
  id = '',
  className = '',
  previewMode = false,
  schema,
  styleCache = '',
  variables
}: BuilderAreaPreviewProps) => {
  const { settings, flat } = schema ?? {};
  const { rootRef } = use(ContainerRootContext);
  const { displayBorderComponents } = use(AppContext);

  const getWindow = useCallback(() => {
    if (typeof window !== 'undefined') {
      return window;
    }

    // @todo: Hmm what to put here
    return { innerWidth: 1440, innerHeight: 900 } as Window;
  }, []);

  const plitziContextValue = useMemo(
    () => ({
      settings: { previewMode, ...settings },
      root: { baseElementId: id },
      utils: { getWindow, rootRef },
      customContexts: {},
      contexts: {
        CollectionContext,
        StyleContext,
        ComponentContext,
        PluginsContext,
        DataSourceContext,
        SchemaContext,
        NetworkContext,
        NavigationContext,
        StateManagerContext,
        InteractionsContext,
        SegmentsContext,
        EventBridgeContext
      }
    }),
    [previewMode, settings, id, getWindow, rootRef]
  );

  const css = useMemo(() => {
    const cssVariables = schemaVariablesToCss(variables);
    const cacheParsed = processCssTokens(styleCache, variables);

    return `:root{${cssVariables}}\n${styleFrame}\n${cacheParsed}\n${settings?.customCss ?? ''}`;
  }, [settings?.customCss, styleCache, variables]);

  const { components } = use(ComponentContext);
  const element = useMemo(() => get(flat, id, undefined), [id, flat]);
  const Plugin = useMemo(() => {
    if (!element) {
      return undefined;
    }

    const PluginNode = get(components.current, get(element, 'definition.type', ''), undefined);
    if (!PluginNode) {
      return undefined;
    }

    // eslint-disable-next-line react-hooks/static-components
    return <PluginNode internalProps={{ id, rootId: id }} />;
  }, [components, element, id]);

  return (
    <ContainerFrame className={clsx('builder-area flex', className)} css={css}>
      <PlitziServiceProvider value={plitziContextValue}>
        <DataSourceContextProvider>
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
        </DataSourceContextProvider>
      </PlitziServiceProvider>
    </ContainerFrame>
  );
};

export default BuilderAreaPreview;
