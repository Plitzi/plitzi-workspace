import { useCallback, use, useMemo } from 'react';

import AuthContext from '@plitzi/sdk-auth/AuthContext';
import DataSourceContext from '@plitzi/sdk-shared/dataSource/DataSourceContext';
import { getPathsFromObeject } from '@plitzi/sdk-shared/helpers/utils';
import { createStoreHook } from '@plitzi/sdk-store/createStore';

import type { CommonState, SourceField } from '@plitzi/sdk-shared';
import type { ReactNode } from 'react';

export type AuthSourceProps = {
  children?: ReactNode;
};

const AuthSource = ({ children }: AuthSourceProps) => {
  const { useDataSource } = use(DataSourceContext);
  const { user, authenticated } = use(AuthContext);
  const { useStore } = createStoreHook<CommonState>();
  const [userProvider = 'basic'] = useStore('schema.settings.userProvider');
  const authContextMemo = useMemo(() => {
    switch (userProvider) {
      case 'auth0':
        return {
          isAuthenticated: authenticated,
          user: {
            given_name: '',
            family_name: '',
            nickname: '',
            name: '',
            picture: '',
            locale: '',
            updated_at: '',
            email: '',
            email_verified: false,
            sub: '',
            ...user
          }
        };

      case 'basic':
        return {
          isAuthenticated: authenticated,
          accessToken: user?.accessToken ?? '',
          details: {
            username: '',
            email: '',
            roles: '',
            permissions: '',
            verified: '',
            ...(user?.details ?? {})
          }
        };

      case '':
      default:
        return {};
    }
  }, [userProvider, user, authenticated]);

  const sourceFields = useCallback(() => {
    switch (userProvider) {
      case 'auth0':
      case 'basic':
      case 'custom':
      case '':
      default:
        return getPathsFromObeject(authContextMemo).reduce<SourceField[]>(
          (acum, path) => [...acum, { path, name: `user.${path}` }],
          []
        );
    }
  }, [authContextMemo, userProvider]);

  const [AuthSourceContext] = useDataSource({
    id: 'global',
    source: 'auth',
    mode: 'write',
    name: 'Auth State',
    fields: sourceFields
  });

  return <AuthSourceContext value={authContextMemo}>{children}</AuthSourceContext>;
};

export default AuthSource;
