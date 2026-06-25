import Heading from '@plitzi/plitzi-ui/components/Heading';
import { ContainerRootContext } from '@plitzi/plitzi-ui/ContainerRoot';
import ContainerShadow from '@plitzi/plitzi-ui/ContainerShadow';
import ErrorBoundary from '@plitzi/plitzi-ui/ErrorBoundary';
import clsx from 'clsx';
import { useCallback, use, useMemo } from 'react';

import { defaultElementsSettings } from '@plitzi/sdk-elements/elements/settings';
import EventBridgeContext from '@plitzi/sdk-event-bridge/EventBridgeContext';
import InteractionsContext from '@plitzi/sdk-interactions/InteractionsContext';
import NavigationContext from '@plitzi/sdk-navigation/NavigationContext';
import PluginsContext from '@plitzi/sdk-plugins/PluginsContext';
import BuilderContext from '@plitzi/sdk-shared/builder/contexts/BuilderContext';
import CollectionContext from '@plitzi/sdk-shared/collections/CollectionContext';
import ComponentContext from '@plitzi/sdk-shared/elements/ComponentContext';
import { emptyObject } from '@plitzi/sdk-shared/helpers/utils';
import { PlitziServiceProvider } from '@plitzi/sdk-shared/hooks/usePlitziServiceContext';
import NetworkContext from '@plitzi/sdk-shared/network/NetworkContext';
import SegmentsContext from '@plitzi/sdk-shared/segments/SegmentsContext';
import { useBuilderStore } from '@plitzi/sdk-shared/store';
import { ThemeContext } from '@plitzi/sdk-shared/theme';
import AppContext from '@pmodules/App/AppContext';

import type { ComponentPlugin } from '@plitzi/sdk-shared';
import type { PlitziServiceContextValue } from '@plitzi/sdk-shared/hooks/usePlitziServiceContext';
import type { FC } from 'react';

export type ElementSettingsProps = {
  id?: string;
  type?: string;
  attributes?: Record<string, unknown>;
  handleChange?: (key: string, value: string | boolean | number | object, isDefinition?: boolean) => void;
};

const ElementSettings = ({ id = '', type = '', attributes = emptyObject, handleChange }: ElementSettingsProps) => {
  const { previewMode, displayBorderComponents } = use(AppContext);
  const { getComponent } = use(ComponentContext);
  const { theme } = use(ThemeContext);
  const Plugin = getComponent(type) as ComponentPlugin | undefined;
  const { pluginSettingsStyles } = use(PluginsContext);
  const { currentPageId } = use(NavigationContext);
  const {
    baseContext: { baseElementId }
  } = use(BuilderContext);
  const { rootRef } = use(ContainerRootContext);

  const getWindow = useCallback(() => {
    // if (ref.current) {
    //   return ref.current.contentWindow;
    // }

    return window;
  }, []); // ref

  const plitziContextValue = useMemo<PlitziServiceContextValue>(
    () => ({
      settings: {
        previewMode,
        currentPageId,
        theme
      },
      root: {
        baseElementId
      },
      utils: {
        displayBorderComponents,
        getWindow,
        rootRef
      },
      customContexts: { ContainerRootContext },
      contexts: {
        ComponentContext,
        CollectionContext,
        NetworkContext,
        PluginsContext,
        NavigationContext,
        SegmentsContext,
        EventBridgeContext,
        InteractionsContext
      }
    }),
    [previewMode, currentPageId, theme, baseElementId, displayBorderComponents, getWindow, rootRef]
  );

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const Settings = (Plugin?.pluginSettings ?? defaultElementsSettings[type]) as FC<any> | undefined;
  const [variables = emptyObject] = useBuilderStore('runtime.sources.variables');

  const children = useMemo(
    () => (
      <PlitziServiceProvider value={plitziContextValue}>
        <ErrorBoundary>
          {Settings && (
            <div className={clsx('flex h-full flex-col', { dark: theme === 'dark' })}>
              <Heading as="h5" className="m-0">
                Settings
              </Heading>
              <Settings {...attributes} id={id} variables={variables} onUpdate={handleChange} />
            </div>
          )}
          {!Settings && <div className="element-tools--empty">Settings not available.</div>}
        </ErrorBoundary>
      </PlitziServiceProvider>
    ),
    [plitziContextValue, Settings, theme, attributes, id, variables, handleChange]
  );

  if (Plugin && pluginSettingsStyles?.[type] && pluginSettingsStyles[type].length > 0) {
    return (
      <ContainerShadow
        className="flex h-full flex-col"
        fallback={
          <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <link
              rel="stylesheet"
              href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/7.0.1/css/all.min.css"
              integrity="sha512-2SwdPD6INVrV/lHTZbO2nodKhrnDdJK9/kg2XD1r9uGqPo1cUbujc+IYdlYdEErWNu69gVcYgdxlmVmzTWnetw=="
              crossOrigin="anonymous"
              referrerPolicy="no-referrer"
            />
            <i className="fa-solid fa-sync fa-spin fa-3x" />
          </div>
        }
      >
        {pluginSettingsStyles[type].map((style, i) => (
          <ContainerShadow.Link key={i} href={style} />
        ))}
        <ContainerShadow.Content>{children}</ContainerShadow.Content>
      </ContainerShadow>
    );
  }

  return children;
};

export default ElementSettings;
