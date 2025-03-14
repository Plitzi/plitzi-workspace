// Packages
import React, { useEffect } from 'react';
import ReactDOM from 'react-dom/client';

// Alias
import Builder from '@pmodules/Builder';

// Relatives
import App from './App';
import { disableReactDevTools } from './helpers/security';

export function render(widgetContainer, params = {}, plugins = {}, debugMode = false) {
  const Widget = () => {
    const pluginKeys = Object.keys(plugins);
    if (process.env.NODE_ENV === 'production' && !debugMode) {
      disableReactDevTools();
    }

    return (
      <App {...params} debugMode={debugMode}>
        {pluginKeys.map(pluginType => (
          <Builder.Plugin key={pluginType} renderType={pluginType} component={plugins[pluginType]} />
        ))}
      </App>
    );
  };

  if (typeof document === 'undefined') {
    return;
  }

  const root = ReactDOM.createRoot(document.getElementById(widgetContainer));
  root.render(<Widget />);
}

/**
 * @param {{
 *   className?: string;
 *   children: React.ReactNode;
 *   webKey?: string;
 *   environment?: string;
 *   currentPageId?: string;
 *   userKey?: string;
 *   server: {
 *     graphqlServer: string;
 *     basePath: string;
 *     subscriptionServer: string;
 *     host: string;
 *     websocketServer: string;
 *   };
 *   includeSubscriptions?: boolean;
 *   includeRealTime?: boolean;
 *   builderEnvironment?: string;
 *   renderMode?: 'raw' | 'iframe' | 'shadow';
 *   externalStyle?: string;
 *   state?: object;
 *   debugMode?: boolean;
 * }} props
 * @returns {React.ReactElement}
 */
const PlitziBuilder = props => {
  const { debugMode = false, children } = props;

  useEffect(() => {
    if (process.env.NODE_ENV === 'production' && !debugMode) {
      disableReactDevTools();
    }
  }, []);

  return <App {...props}>{children}</App>;
};

PlitziBuilder.Plugin = Builder.Plugin;

export const { version } = VERSION;

export default PlitziBuilder;
