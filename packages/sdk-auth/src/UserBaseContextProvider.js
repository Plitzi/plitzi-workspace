// Packages
import React, { useMemo, use } from 'react';
import get from 'lodash/get';
import { useAuth0 } from '@auth0/auth0-react';

// Monorepo
import SchemaSettingsContext from '@plitzi/sdk-schema/SchemaSettingsContext';

// Relatives
import withUserProvider from './hocs/withUserProvider';
import UserContext from './UserContext';
import useAuth from './hooks/useAuth';

/**
 * @param {{
 *   previewMode: boolean;
 *   children: React.ReactNode;
 *   webId: string | number;
 * }} props
 * @returns {React.ReactElement}
 */
const UserBaseContextProvider = props => {
  const { previewMode = true, children, webId = 0 } = props;
  const {
    userProvider,
    loginUrl,
    refreshUrl,
    detailsPath = 'details',
    tokenPath = 'access_token',
    expirationTimePath = 'expire_at'
  } = use(SchemaSettingsContext);
  let loading = false;
  switch (userProvider) {
    case 'auth0':
      loading = get(useAuth0(), 'isLoading', false) && previewMode;
      break;

    case 'basic':
    case '':
    default:
  }

  const { manager } = useAuth({
    provider: userProvider,
    loginUrl,
    refreshUrl,
    webId,
    detailsPath,
    tokenPath,
    expirationTimePath
  });
  const valueMemo = useMemo(() => {
    if (!manager) {
      return {
        login: () => {},
        logout: () => {},
        refreshDetails: () => {},
        can: () => false,
        authenticated: false,
        user: {
          details: {},
          accessToken: ''
        }
      };
    }

    return {
      login: manager.login,
      logout: manager.logout,
      refreshDetails: manager.refreshDetails,
      can: manager.can,
      authenticated: manager.isAuthenticated || !previewMode,
      user: {
        details: manager.userDetails,
        accessToken: manager.accessToken
      }
    };
  }, [manager, manager?.userDetails, manager?.isAuthenticated, previewMode]);

  return <UserContext value={valueMemo}>{!loading && children}</UserContext>;
};

export default withUserProvider(UserBaseContextProvider);
