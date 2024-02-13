// Packages
import React, { forwardRef, useContext, useMemo } from 'react';
import get from 'lodash/get';
import { Auth0Provider } from '@auth0/auth0-react';

// Alias
import NetworkContext from '@pmodules/Network/NetworkContext';
import SchemaMainContext from '@pmodules/Schema/SchemaMainContext';

// Relatives
import { getDisplayName } from '../../../helpers/utils';
import PlitziUserContextProvider from '../userProviders/plitzi/PlitziUserContextProvider';

const withUserProvider = WrappedComponent => {
  const WithUserProviderComponent = forwardRef((props, ref) => {
    const {
      settings: { userProvider, auth0Domain, auth0ClientId }
    } = useContext(SchemaMainContext);
    const { server, webKeyDecoded } = useContext(NetworkContext);
    const webId = useMemo(() => `${get(webKeyDecoded, 'data.spaceId', '')}`, [webKeyDecoded]);
    switch (userProvider) {
      case 'auth0':
        return (
          <Auth0Provider
            domain={auth0Domain}
            clientId={auth0ClientId}
            authorizationParams={{ redirect_uri: window.location.origin }}
          >
            <WrappedComponent {...props} ref={ref} userProvider={userProvider} />
          </Auth0Provider>
        );

      case 'plitzi':
        return (
          <PlitziUserContextProvider webId={webId} server={server}>
            <WrappedComponent {...props} ref={ref} userProvider={userProvider} />
          </PlitziUserContextProvider>
        );

      default:
        return <WrappedComponent {...props} ref={ref} userProvider={userProvider} />;
    }
  });

  WithUserProviderComponent.displayName = `withUserProvider(${getDisplayName(WrappedComponent)})`;

  WithUserProviderComponent.propTypes = {};

  return WithUserProviderComponent;
};

export default withUserProvider;
