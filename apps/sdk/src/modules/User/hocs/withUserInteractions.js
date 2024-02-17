// Packages
import React, { forwardRef, useCallback, useContext, useMemo } from 'react';

// Monorepo
import InteractionsContext from '@repo/interactions-shared/InteractionsContext';

// Alias
import SchemaSettingsContext from '@modules/Schema/SchemaSettingsContext';

// Relatives
import { getDisplayName } from '../../../helpers/utils';
import UserContext from '../UserContext';

const withUserInteractions = WrappedComponent => {
  const WithUserInteractionsComponent = forwardRef((props, ref) => {
    const { userProvider } = useContext(SchemaSettingsContext);
    const { login, refreshDetails, logout } = useContext(UserContext);
    const { useInteractions } = useContext(InteractionsContext);

    const handleLogin = useCallback(async params => login(params), [login]);

    const handleRefreshDetails = useCallback(async params => refreshDetails(params), [refreshDetails]);

    const handleLogout = useCallback(() => logout(), [logout]);

    const interactionCallbacks = useMemo(() => {
      let userCallbacks = {};
      if (userProvider === 'auth0') {
        userCallbacks = {
          login: { title: 'User Login', callback: handleLogin, params: {} },
          logout: { title: 'User Logout', callback: handleLogout, params: {} }
        };
      } else if (userProvider === 'plitzi') {
        userCallbacks = {
          login: {
            title: 'User Login',
            type: 'globalCallback',
            callback: handleLogin,
            params: {
              mode: {
                label: 'Mode',
                canBind: false,
                type: 'select',
                defaultValue: 'normal',
                options: [
                  { label: 'Token', value: 'token' },
                  { label: 'User and Password', value: 'normal' }
                ]
              },
              username: {
                defaultValue: '',
                when: params => params.mode === 'normal'
              },
              password: {
                defaultValue: '',
                when: params => params.mode === 'normal'
              },
              token: {
                defaultValue: '',
                when: params => params.mode === 'token'
              }
            },
            preview: {
              errors: { mode: '', username: '', password: '' },
              success: '',
              access_token: '',
              expires_at: '',
              expires_in: '',
              details: {
                id: '',
                username: '',
                email: '',
                verified: '',
                permissions: ''
              }
            }
          },
          refreshDetails: {
            title: 'User Refresh Details',
            type: 'globalCallback',
            callback: handleRefreshDetails,
            params: {},
            preview: {
              success: '',
              access_token: '',
              expires_at: '',
              expires_in: '',
              details: {
                id: '',
                username: '',
                email: '',
                roles: '',
                permissions: '',
                verified: ''
              }
            }
          },
          logout: { title: 'User Logout', type: 'globalCallback', callback: handleLogout, preview: {}, params: {} }
        };
      }

      return userCallbacks;
    }, [handleLogin, handleLogout]);

    useInteractions({ id: 'user', callbacks: interactionCallbacks });

    return <WrappedComponent ref={ref} {...props} userProvider={userProvider} />;
  });

  WithUserInteractionsComponent.displayName = `withUserInteractions(${getDisplayName(WrappedComponent)})`;

  WithUserInteractionsComponent.propTypes = {};

  return WithUserInteractionsComponent;
};

export default withUserInteractions;
