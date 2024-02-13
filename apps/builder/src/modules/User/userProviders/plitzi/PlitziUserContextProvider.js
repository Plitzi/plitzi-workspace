// Packages
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import PropTypes from 'prop-types';
import get from 'lodash/get';
import omit from 'lodash/omit';
import moment from 'moment';
import useCache from '@plitzi/plitzi-ui-components/Cache/useCache';

// Alias
import useNetwork from '@pmodules/Network/hooks/useNetwork';

// Relatives
import PlitziUserContext from './PlitziUserContext';

const PlitziUserContextProvider = props => {
  const { children, webId = '', server } = props;
  const [cache, setCache, , clearCache] = useCache({ cacheId: `user-${webId}-state`, skipContext: true });
  const isAuthenticated = useMemo(() => {
    const expireAt = get(cache, 'expire_at');
    if (!expireAt) {
      return false;
    }

    return expireAt > Math.floor(moment.utc().valueOf() / 1000);
  }, [cache]);
  const [accessToken, setAccessToken] = useState(() => get(cache, 'access_token', ''));
  const [userDetails, setUserDetails] = useState(() => get(cache, 'details'));
  const { networkQuery } = useNetwork({ server, webKey: accessToken, internalUsage: false });

  const refreshDetails = useCallback(
    async token => {
      const response = await networkQuery(`${server.apiServer}/users/me`, {}, 'get', token);
      if (response && response.networkSuccess) {
        const { data } = response;
        if (!data.success) {
          return data;
        }

        const { details } = data;
        setUserDetails(details);
        setCache(omit(data, ['success']));

        return data;
      }

      return false;
    },
    [networkQuery, setCache, server]
  );

  const login = useCallback(
    async params => {
      const { mode, username, password, token } = params;
      if (mode === 'token') {
        setAccessToken(token);
        const data = await refreshDetails(token);

        return data;
      }

      const response = await networkQuery(`${server.apiServer}/auth/login`, { username, password }, 'post');
      if (response && response.networkSuccess) {
        const { data } = response;
        if (!data.success) {
          return data;
        }

        const { details } = data;
        setUserDetails(details);
        setAccessToken(data.access_token);
        setCache(omit(data, ['success']));

        return data;
      }

      return false;
    },
    [networkQuery, setCache, networkQuery, server, refreshDetails]
  );

  const logout = useCallback(() => {
    if (!isAuthenticated) {
      return;
    }

    userDetails(undefined);
    setAccessToken(undefined);
    clearCache();
  }, [isAuthenticated]);

  // const validateAccount = useCallback(
  //   async data => {
  //     const response = await networkQuery('/auth/validate-account', data, 'get');
  //     if (response && response.networkSuccess) {
  //       const { data } = response;
  //       if (!data.success) {
  //         return data;
  //       }

  //       // redirect to login, alert with successful activation

  //       return data;
  //     }

  //     return false;
  //   },
  //   [networkQuery]
  // );

  // const forgotPassword = useCallback(
  //   async data => {
  //     const response = await networkQuery('/auth/forgot-password', data, 'post');
  //     if (response && response.networkSuccess) {
  //       const { data } = response;

  //       return data;
  //     }

  //     return false;
  //   },
  //   [networkQuery]
  // );

  // const resetPassword = useCallback(
  //   async (data, token) => {
  //     const response = await networkQuery(`/auth/reset-password?token=${token}`, data, 'post');
  //     if (response && response.networkSuccess) {
  //       const { data } = response;

  //       return data;
  //     }

  //     return false;
  //   },
  //   [networkQuery]
  // );

  // const verificationEmail = useCallback(
  //   async data => {
  //     const response = await networkQuery('/auth/resend-verification-email', data, 'post');
  //     if (response && response.networkSuccess) {
  //       const { data } = response;

  //       return data;
  //     }

  //     return false;
  //   },
  //   [networkQuery]
  // );

  const can = useCallback(
    permission => {
      if (!userDetails) {
        return false;
      }

      return get(userDetails, 'permissions', []).include(permission);
    },
    [userDetails]
  );

  useEffect(() => {
    const expireAt = get(cache, 'expire_at', 0);
    const remainingTime = expireAt - Math.floor(moment.utc().valueOf() / 1000);
    let timer;
    if (isAuthenticated && remainingTime > 0) {
      timer = setTimeout(() => {
        logout();
      }, remainingTime * 1000);
    }

    return () => {
      if (timer) {
        clearTimeout(timer);
        timer = undefined;
      }
    };
  }, [isAuthenticated, logout]);

  const valueMemo = useMemo(
    () => ({
      login,
      logout,
      details: userDetails,
      accessToken,
      isAuthenticated,
      refreshDetails,
      // validateAccount,
      // forgotPassword,
      // resetPassword,
      // verificationEmail,
      can
    }),
    [
      login,
      logout,
      userDetails,
      accessToken,
      isAuthenticated,
      refreshDetails,
      // validateAccount,
      // forgotPassword,
      // resetPassword,
      // verificationEmail,
      can
    ]
  );

  return <PlitziUserContext.Provider value={valueMemo}>{children}</PlitziUserContext.Provider>;
};

PlitziUserContextProvider.propTypes = {
  children: PropTypes.node,
  webId: PropTypes.string,
  server: PropTypes.object
};

export default PlitziUserContextProvider;
