/* eslint-disable react-refresh/only-export-components */

import { useEffect } from 'react';
import ReactDOM from 'react-dom/client';

import { withElement } from '@plitzi/sdk-elements';
import { useElement } from '@plitzi/sdk-elements';
import { useRscData } from '@plitzi/sdk-elements';
import { JsxManager } from '@plitzi/sdk-elements';
import { PluginManager } from '@plitzi/sdk-elements';
import { PluginRemote } from '@plitzi/sdk-elements';
import { ReplicaProvider } from '@plitzi/sdk-elements';
import { RootElement } from '@plitzi/sdk-elements';
import { ComponentProvider } from '@plitzi/sdk-elements/Component';
import { ComponentContext } from '@plitzi/sdk-shared/elements';
import { disableReactDevTools } from '@plitzi/sdk-shared/helpers';
import { usePlitzi, PlitziProvider } from '@plitzi/sdk-shared/hooks';
import { useBuilderStore } from '@plitzi/sdk-shared/store';
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
  functionsWorkerUrl?: AppProps['functionsWorkerUrl'];
  sdkIconsStylePath?: AppProps['sdkIconsStylePath'];
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
  useBuilderStore,
  ComponentProvider,
  ComponentContext,
  usePlitzi,
  PlitziProvider,
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
