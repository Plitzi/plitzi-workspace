import { use, useCallback, useMemo } from 'react';

import UserContext from '@plitzi/sdk-auth/UserContext';

import InteractionsContext from '../../InteractionsContext';

import type { InteractionBaseCallback } from '@plitzi/sdk-shared';
import type { ReactNode } from 'react';

export type UserInteractionsProps = {
  children?: ReactNode;
  userProvider?: '' | 'auth0' | 'basic' | 'custom';
};

const UserInteractions = ({ children, userProvider = 'basic' }: UserInteractionsProps) => {
  const { login, refreshDetails, logout } = use(UserContext) as {
    login: (params: unknown) => unknown;
    refreshDetails: (params: unknown) => unknown;
    logout: () => boolean;
  };
  const { useInteractions } = use(InteractionsContext);

  const handleLogin = useCallback(
    (params: Parameters<NonNullable<InteractionBaseCallback['callback']>>[0]) => login(params),
    [login]
  );

  const handleRefreshDetails = useCallback(
    (params: Parameters<NonNullable<InteractionBaseCallback['callback']>>[0]) => refreshDetails(params),
    [refreshDetails]
  );

  const handleLogout = useCallback(() => logout(), [logout]);

  const interactionCallbacks = useMemo(() => {
    let userCallbacks: Record<string, InteractionBaseCallback> = {};
    if (userProvider === 'auth0') {
      userCallbacks = {
        login: {
          action: 'userLogin',
          title: 'User Login',
          type: 'globalCallback',
          callback: handleLogin,
          params: {}
        },
        logout: {
          action: 'userLogout',
          title: 'User Logout',
          type: 'globalCallback',
          callback: handleLogout,
          params: {}
        }
      };
    } else if (userProvider === 'basic') {
      userCallbacks = {
        login: {
          action: 'userLogin',
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
              type: 'text',
              defaultValue: '',
              when: params => params.mode === 'normal'
            },
            password: {
              type: 'text',
              defaultValue: '',
              when: params => params.mode === 'normal'
            },
            token: {
              type: 'text',
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
          action: 'userRefreshDetails',
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
        logout: {
          action: 'userLogout',
          title: 'User Logout',
          type: 'globalCallback',
          callback: handleLogout,
          preview: {},
          params: {}
        }
      };
    }

    return userCallbacks;
  }, [handleLogin, handleLogout, handleRefreshDetails, userProvider]);

  useInteractions({ id: 'user', callbacks: interactionCallbacks });

  return children;
};

export default UserInteractions;
