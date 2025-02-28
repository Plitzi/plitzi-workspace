import { useCallback, use, useMemo } from 'react';

import UserContext from '@plitzi/sdk-auth/UserContext';
import SchemaSettingsContext from '@plitzi/sdk-schema/SchemaSettingsContext';
import { getPathsFromObeject } from '@plitzi/sdk-shared/utils';

import DataSourceContext from '../DataSourceContext';

import type { SourceField } from '@plitzi/sdk-shared';
import type { ReactNode } from 'react';

export type UserSourceProps = {
  children?: ReactNode;
};

const UserSource = ({ children }: UserSourceProps) => {
  const { useDataSource } = use(DataSourceContext);
  const { user, authenticated } = use(UserContext);
  const { userProvider = 'basic' } = use(SchemaSettingsContext);
  const userContextMemo = useMemo(() => {
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
      case '':
      default:
        return getPathsFromObeject(userContextMemo).reduce<SourceField[]>(
          (acum, path) => [...acum, { path, name: `user.${path}` }],
          []
        );
    }
  }, [userContextMemo, userProvider]);

  const [UserSourceContext] = useDataSource({
    id: 'global',
    source: 'user',
    mode: 'write',
    name: 'User State',
    fields: sourceFields
  });

  return <UserSourceContext value={userContextMemo}>{children}</UserSourceContext>;
};

export default UserSource;
