// Packages
import { use, useCallback, useMemo } from 'react';

// Monorepo
import UserContext from '@plitzi/sdk-auth/UserContext';

// Relatives
import InteractionsContext from '../../InteractionsContext';

// Types
import type { InteractionCallback } from '../../InteractionsManager';
import type { ReactNode } from 'react';

export type UserInteractionsProps = {
  children?: ReactNode;
  userProvider: 'auth0' | 'basic' | 'unknown';
};

const UserInteractions = ({ children, userProvider = 'basic' }: UserInteractionsProps) => {
  const { login, refreshDetails, logout } = use(UserContext) as {
    login: (params: unknown) => unknown;
    refreshDetails: (params: unknown) => unknown;
    logout: () => boolean;
  };
  const { useInteractions } = use(InteractionsContext);

  const handleLogin = useCallback((params: InteractionCallback['params']) => login(params), [login]);

  const handleRefreshDetails = useCallback(
    (params: InteractionCallback['params']) => refreshDetails(params),
    [refreshDetails]
  );

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
              when: (params: InteractionCallback['params']) => params.mode === 'normal'
            },
            password: {
              defaultValue: '',
              when: (params: InteractionCallback['params']) => params.mode === 'normal'
            },
            token: {
              defaultValue: '',
              when: (params: InteractionCallback['params']) => params.mode === 'token'
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
  }, [handleLogin, handleLogout, handleRefreshDetails, userProvider]);

  useInteractions({ id: 'user', callbacks: interactionCallbacks });

  return children;
};

export default UserInteractions;
