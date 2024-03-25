// Packages
import React, { forwardRef, useCallback, useContext, useMemo } from 'react';
import PropTypes from 'prop-types';
import omit from 'lodash/omit';

// Monorepo
import useDataSource from '@plitzi/sdk-data-source/hooks/useDataSource';
import { getDisplayName, getPathsFromObeject } from '@plitzi/sdk-shared/utils';

// Relatives
import RealUserContext from '../UserContext';

const withUserDataSource = WrappedComponent => {
  const WithUserDataSourceComponent = forwardRef((props, ref) => {
    const { previewMode = true, userProvider = 'basic' } = props;
    const { user, authenticated } = useContext(RealUserContext);
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
    }, [userProvider, previewMode, user, authenticated]);

    const userFields = useCallback(async () => {
      switch (userProvider) {
        case 'auth0':
        case 'basic':
        case '':
        default:
          return getPathsFromObeject(userContextMemo).reduce((acum, path) => [...acum, { path, name: path }], []);
      }
    }, [userContextMemo, userProvider]);

    useDataSource({ id: 'global', source: 'user', name: 'User State', value: userContextMemo, fields: userFields });

    return <WrappedComponent ref={ref} {...omit(props, ['userProvider'])} />;
  });

  WithUserDataSourceComponent.displayName = `withUserDataSource(${getDisplayName(WrappedComponent)})`;

  WithUserDataSourceComponent.propTypes = {
    previewMode: PropTypes.bool,
    userProvider: PropTypes.oneOf(['basic', 'auth0', ''])
  };

  return WithUserDataSourceComponent;
};

export default withUserDataSource;
