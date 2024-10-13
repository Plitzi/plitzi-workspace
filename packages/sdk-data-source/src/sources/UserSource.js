// Packages
import React, { useCallback, use, useMemo } from 'react';

// Monorepo
import { getPathsFromObeject } from '@plitzi/sdk-shared/utils';
import UserContext from '@plitzi/sdk-auth/UserContext';
import SchemaSettingsContext from '@plitzi/sdk-schema/SchemaSettingsContext';

// Relatives
import DataSourceContext from '../DataSourceContext';

/**
 * @param {{
 *   children: React.ReactNode;
 * }} props
 * @returns {React.ReactElement}
 */
const UserSource = props => {
  const { children } = props;
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

  const sourceFields = useCallback(async () => {
    switch (userProvider) {
      case 'auth0':
      case 'basic':
      case '':
      default:
        return getPathsFromObeject(userContextMemo).reduce((acum, path) => [...acum, { path, name: `user.${path}` }], []);
    }
  }, [userContextMemo, userProvider]);

  const [UserSourceContext] = useDataSource({ id: 'global', source: 'user', name: 'User State', fields: sourceFields });

  return <UserSourceContext value={userContextMemo}>{children}</UserSourceContext>;
};

export default UserSource;
