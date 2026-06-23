/* eslint-disable react-refresh/only-export-components */

import { useEffect } from 'react';
import ReactDOM from 'react-dom/client';

import ComponentProvider from '@plitzi/sdk-elements/Component/ComponentProvider';
import withElement from '@plitzi/sdk-elements/Element/hocs/withElement';
import useElement from '@plitzi/sdk-elements/Element/hooks/useElement';
import useRscData from '@plitzi/sdk-elements/Element/hooks/useRscData';
import JsxManager from '@plitzi/sdk-elements/Element/JsxManager';
import { PlitziElementsProvider } from '@plitzi/sdk-elements/Element/PlitziElementsProvider';
import PluginManager from '@plitzi/sdk-elements/Element/PluginManager';
import PluginRemote from '@plitzi/sdk-elements/Element/PluginRemote';
import ReplicaProvider from '@plitzi/sdk-elements/Element/ReplicaProvider';
import RootElement from '@plitzi/sdk-elements/Element/RootElement';
import ComponentContext from '@plitzi/sdk-shared/elements/ComponentContext';
import { disableReactDevTools } from '@plitzi/sdk-shared/helpers/security';
import usePlitziServiceContext, { PlitziServiceProvider } from '@plitzi/sdk-shared/hooks/usePlitziServiceContext';
import Builder from '@pmodules/Builder';

import App from './App';
import packageSettings from '../package.json';

import type { AppProps } from './App';
import type { ComponentPlugin, RenderMode, Server } from '@plitzi/sdk-shared';
import type { ReactNode } from 'react';

export function render(
  widgetContainer: string,
  params = {} as AppProps,
  plugins: Record<string, ComponentPlugin> = {},
  debugMode = false
) {
  const Widget = () => {
    if (process.env.NODE_ENV === 'production' && !debugMode) {
      disableReactDevTools();
    }

    return (
      <App {...params} debugMode={debugMode}>
        {Object.keys(plugins).map(pluginType => (
          <Builder.Plugin
            key={pluginType}
            renderType={pluginType}
            settings={plugins[pluginType].pluginSettings}
            definition={plugins[pluginType].content}
            component={plugins[pluginType]}
          />
        ))}
      </App>
    );
  };

  if (typeof document === 'undefined') {
    return;
  }

  const root = ReactDOM.createRoot(document.getElementById(widgetContainer) as HTMLDivElement);
  root.render(<Widget />);
}

export type PlitziBuilderProps = {
  className?: string;
  children?: ReactNode;
  webKey: string;
  environment?: string;
  currentPageId?: string;
  userKey?: string;
  server?: Partial<Server>;
  includeSubscriptions?: boolean;
  includeRealTime?: boolean;
  renderMode?: RenderMode;
  externalStyle?: string;
  state?: object;
  debugMode?: boolean;
};

const PlitziBuilder = (props: PlitziBuilderProps) => {
  const { debugMode = false, children } = props;

  useEffect(() => {
    if (process.env.NODE_ENV === 'production' && !debugMode) {
      disableReactDevTools();
    }
  }, [debugMode]);

  return <App {...props}>{children}</App>;
};

PlitziBuilder.Plugin = Builder.Plugin;

export const { version } = packageSettings;

// SDK Exports

export {
  ComponentProvider,
  ComponentContext,
  usePlitziServiceContext,
  PlitziServiceProvider,
  PlitziElementsProvider,
  RootElement,
  withElement,
  JsxManager,
  PluginManager,
  PluginRemote,
  ReplicaProvider,
  useElement,
  useRscData
};

export default PlitziBuilder;
