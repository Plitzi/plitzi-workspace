import { Auth0Provider } from '@auth0/auth0-react';
import { use } from 'react';

import SchemaSettingsContext from '@plitzi/sdk-schema/SchemaSettingsContext';
import { getDisplayName } from '@plitzi/sdk-shared/utils';

import type { FC } from 'react';

export type WithUserProviderProps<T> = T;

const withUserProvider = <T extends object>(WrappedComponent: FC<T>) => {
  const WithUserProviderComponent = ({ ...props }: WithUserProviderProps<T>) => {
    const { userProvider, auth0Domain, auth0ClientId } = use(SchemaSettingsContext);
    switch (userProvider) {
      case 'auth0':
        return (
          <Auth0Provider
            domain={auth0Domain as string}
            clientId={auth0ClientId as string}
            authorizationParams={{ redirect_uri: window.location.origin }}
          >
            <WrappedComponent {...props} />
          </Auth0Provider>
        );

      case 'basic':
      default:
        return <WrappedComponent {...props} />;
    }
  };

  WithUserProviderComponent.displayName = `withUserProvider(${getDisplayName(WrappedComponent)})`;

  return WithUserProviderComponent;
};

export default withUserProvider;
