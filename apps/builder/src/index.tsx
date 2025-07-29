/* eslint-disable react-refresh/only-export-components */
import { useEffect } from 'react';
import ReactDOM from 'react-dom/client';

import Builder from '@pmodules/Builder';

import App from './App';
import packageSettings from '../package.json';
import { disableReactDevTools } from './helpers/security';

import type { AppProps } from './App';
import type { ComponentPlugin, Server } from '@plitzi/sdk-shared';
import type { ReactNode } from 'react';

export function render(
  widgetContainer: string,
  params = {} as AppProps,
  plugins: Record<string, ComponentPlugin> = {},
  debugMode = false
) {
  const Widget = () => {
    const pluginKeys = Object.keys(plugins);
    if (process.env.NODE_ENV === 'production' && !debugMode) {
      disableReactDevTools();
    }

    return (
      <App {...params}>
        {pluginKeys.map(pluginType => (
          <Builder.Plugin key={pluginType} renderType={pluginType} component={plugins[pluginType]} />
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
  children: ReactNode;
  webKey: string;
  environment?: string;
  currentPageId?: string;
  userKey?: string;
  server?: Server;
  includeSubscriptions?: boolean;
  includeRealTime?: boolean;
  builderEnvironment?: 'development' | 'staging' | 'production';
  renderMode?: 'raw' | 'iframe' | 'shadow';
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

export default PlitziBuilder;
