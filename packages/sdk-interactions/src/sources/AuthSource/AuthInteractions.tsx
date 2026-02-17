import { use, useCallback, useMemo } from 'react';

import { AuthContext } from '@plitzi/sdk-auth';

import InteractionsContext from '../../InteractionsContext';

import type { InteractionCallback } from '@plitzi/sdk-shared';
import type { ReactNode } from 'react';

export type AuthInteractionsProps = {
  children?: ReactNode;
  authProvider?: '' | 'auth0' | 'basic' | 'custom';
};

const AuthInteractions = ({ children, authProvider = 'basic' }: AuthInteractionsProps) => {
  const { login, refresh, logout } = use(AuthContext);
  const { useInteractions } = use(InteractionsContext);

  const handleLogin = useCallback(
    (params: Parameters<NonNullable<InteractionCallback['callback']>>[0]) => login(params),
    [login]
  );

  const handleRefresh = useCallback(
    (params: Parameters<NonNullable<InteractionCallback['callback']>>[0]) => refresh(params),
    [refresh]
  );

  const handleLogout = useCallback(() => logout(), [logout]);

  const interactionCallbacks = useMemo(() => {
    let authCallbacks: Record<string, InteractionCallback> = {};
    if (authProvider === 'auth0') {
      authCallbacks = {
        login: {
          action: 'authLogin',
          title: 'Auth Login',
          type: 'globalCallback',
          callback: handleLogin,
          params: {}
        },
        logout: {
          action: 'authLogout',
          title: 'Auth Logout',
          type: 'globalCallback',
          callback: handleLogout,
          params: {}
        }
      };
    } else if (authProvider === 'basic') {
      authCallbacks = {
        login: {
          action: 'authLogin',
          title: 'Auth Login',
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
          action: 'authRefreshDetails',
          title: 'Auth Refresh Details',
          type: 'globalCallback',
          callback: handleRefresh,
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
          action: 'authLogout',
          title: 'Auth Logout',
          type: 'globalCallback',
          callback: handleLogout,
          preview: {},
          params: {}
        }
      };
    }

    return authCallbacks;
  }, [handleLogin, handleLogout, handleRefresh, authProvider]);

  useInteractions({ id: 'auth', callbacks: interactionCallbacks });

  return children;
};

export default AuthInteractions;
