// Debugger helper
import './wdyr';

// Packages
import React, { useEffect } from 'react';
import ReactDOM from 'react-dom/client';
import PropTypes from 'prop-types';
import omit from 'lodash/omit';

// Alias
import Builder from '@pmodules/Builder';

// Relatives
import App from './App';
import { disableReactDevTools } from './helpers/security';

// Builder Style
import './assets/index.scss';

export function render(widgetContainer, params = {}, plugins = {}, debugMode = false) {
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

  const root = ReactDOM.createRoot(document.getElementById(widgetContainer));
  root.render(<Widget />);
}

const PlitziBuilder = props => {
  const { debugMode = false, children } = props;

  useEffect(() => {
    if (process.env.NODE_ENV === 'production' && !debugMode) {
      disableReactDevTools();
    }
  }, []);

  return <App {...omit(props, ['debugMode'])}>{children}</App>;
};

PlitziBuilder.propTypes = {
  className: PropTypes.string,
  children: PropTypes.node,
  // Space
  webKey: PropTypes.string,
  environment: PropTypes.string,
  currentPageId: PropTypes.string,
  // Server
  userKey: PropTypes.string,
  server: PropTypes.object, // { graphqlServer, basePath, subscriptionServer, host, websocketServer }
  debugMode: PropTypes.bool,
  includeSubscriptions: PropTypes.bool,
  includeRealTime: PropTypes.bool,
  // Extra
  builderEnvironment: PropTypes.string,
  renderMode: PropTypes.oneOf(['raw', 'iframe', 'shadow']),
  externalStyle: PropTypes.string,
  state: PropTypes.object
};

PlitziBuilder.Plugin = Builder.Plugin;

export const { version } = VERSION;

export default PlitziBuilder;
