// Packages
import { use, useCallback, useMemo } from 'react';

// Monorepo
import InteractionsContext from '@plitzi/sdk-interactions/InteractionsContext';
import UserContext from '@plitzi/sdk-auth/UserContext';

/**
 * @param {{
 *   children: React.ReactNode;
 *   userProvider: 'auth0' | 'basic';
 * }} props
 * @returns {React.ReactElement}
 */
const UserInteractions = props => {
  const { children, userProvider = 'basic' } = props;

  const { login, refreshDetails, logout } = use(UserContext);
  const { useInteractions } = use(InteractionsContext);

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
    } else if (userProvider === 'basic') {
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
            errors: { username: '', password: '', token: '' },
            success: '',
            access_token: '',
            expires_at: '',
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
            errors: '',
            success: '',
            access_token: '',
            expires_at: '',
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

  return children;
};

export default UserInteractions;
