// Packages
import React, { useCallback, useContext, useMemo } from 'react';
import PropTypes from 'prop-types';
import get from 'lodash/get';
import { useAuth0 } from '@auth0/auth0-react';

// Alias
import SchemaSettingsContext from '@modules/Schema/SchemaSettingsContext';

// Relatives
import withUserProvider from './hocs/withUserProvider';
import { isAuthenticated } from './helpers/UserHelper';
import PlitziUserContext from './userProviders/plitzi/PlitziUserContext';
import UserContext from './UserContext';

const UserBaseContextProvider = props => {
  const { previewMode = true, children } = props;
  const { userProvider } = useContext(SchemaSettingsContext);
  let authData;
  let loading = false;
  switch (userProvider) {
    case 'auth0':
      authData = useAuth0();
      loading = get(authData, 'isLoading', false) && previewMode;
      break;

    case 'plitzi':
      authData = useContext(PlitziUserContext);
      break;

    case '':
    default:
  }

  const authenticated = useMemo(
    () => isAuthenticated(authData, userProvider, previewMode),
    [authData, userProvider, previewMode]
  );

  const handleLogin = useCallback(
    async params => {
      switch (userProvider) {
        case 'auth0': {
          authData.loginWithRedirect();
          break;
        }

        case 'plitzi': {
          return authData.login(params);
        }

        case '':
        default:
      }

      return undefined;
    },
    [authData, userProvider]
  );

  const handleRefreshDetails = useCallback(async () => {
    switch (userProvider) {
      case 'auth0': {
        authData.refreshToken();
        break;
      }

      case 'plitzi': {
        return authData.refreshDetails();
      }

      case '':
      default:
    }

    return undefined;
  }, [authData, userProvider]);

  const handleLogout = useCallback(() => {
    switch (userProvider) {
      case 'auth0': {
        authData.logout();
        break;
      }

      case 'plitzi':
        authData.logout();
        break;

      case '':
      default:
    }
  }, [authData, userProvider]);

  const handleCan = useCallback(
    permission => {
      if (!authData || !authData.details) {
        return false;
      }

      return get(authData, 'details.permissions', []).include(permission);
    },
    [authData]
  );

  const valueMemo = useMemo(
    () => ({
      login: handleLogin,
      refreshDetails: handleRefreshDetails,
      logout: handleLogout,
      user: authData,
      authenticated,
      can: handleCan
    }),
    [handleLogin, handleRefreshDetails, handleLogout, authData, authenticated, handleCan]
  );

  return <UserContext.Provider value={valueMemo}>{!loading && children}</UserContext.Provider>;
};

UserBaseContextProvider.propTypes = {
  children: PropTypes.node,
  previewMode: PropTypes.bool
};

export default withUserProvider(UserBaseContextProvider);
