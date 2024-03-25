// Packages
import React, { useMemo, useContext } from 'react';
import PropTypes from 'prop-types';
import get from 'lodash/get';
import { useAuth0 } from '@auth0/auth0-react';

// Monorepo
import SchemaSettingsContext from '@plitzi/sdk-schema/SchemaSettingsContext';

// Relatives
import withUserProvider from './hocs/withUserProvider';
import UserContext from './UserContext';
import useAuth from './hooks/useAuth';

const UserBaseContextProvider = props => {
  const { previewMode = true, children, webId = 0 } = props;
  const { userProvider, loginUrl, refreshUrl } = useContext(SchemaSettingsContext);
  let loading = false;
  switch (userProvider) {
    case 'auth0':
      loading = get(useAuth0(), 'isLoading', false) && previewMode;
      break;

    case 'basic':
    case '':
    default:
  }

  const { manager } = useAuth({ provider: userProvider, loginUrl, refreshUrl, webId });
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

  return <UserContext.Provider value={valueMemo}>{!loading && children}</UserContext.Provider>;
};

UserBaseContextProvider.propTypes = {
  children: PropTypes.node,
  webId: PropTypes.number,
  previewMode: PropTypes.bool
};

export default withUserProvider(UserBaseContextProvider);
