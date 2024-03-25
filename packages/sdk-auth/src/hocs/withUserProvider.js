// Packages
import React, { forwardRef, useContext } from 'react';
import { Auth0Provider } from '@auth0/auth0-react';

// Monorepo
import { getDisplayName } from '@plitzi/sdk-shared/utils';
import SchemaSettingsContext from '@plitzi/sdk-schema/SchemaSettingsContext';

const withUserProvider = WrappedComponent => {
  const WithUserProviderComponent = forwardRef((props, ref) => {
    const { userProvider, auth0Domain, auth0ClientId } = useContext(SchemaSettingsContext);
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

      case 'basic':
      default:
        return <WrappedComponent {...props} ref={ref} userProvider={userProvider} />;
    }
  });

  WithUserProviderComponent.displayName = `withUserProvider(${getDisplayName(WrappedComponent)})`;

  WithUserProviderComponent.propTypes = {};

  return WithUserProviderComponent;
};

export default withUserProvider;
