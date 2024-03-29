// Packages
import get from 'lodash/get';
import moment from 'moment';
import axios from 'axios';

class BasicProvider {
  constructor(props = {}) {
    const {
      cache,
      setCache,
      clearCache,
      loginUrl,
      refreshUrl,
      detailsPath = 'details',
      tokenPath = 'access_token',
      expirationTimePath = 'expire_at'
    } = props;
    this.userDetails = get(cache, 'details', undefined);
    this.accessToken = get(cache, 'access_token', undefined);
    this.isAuthenticated = !!this.userDetails && !!this.accessToken;
    this.expireAt = get(cache, 'expire_at', 0);
    this.expireIn = get(cache, 'expire_in', 0);
    this.expireHandler = undefined;

    // Cache
    this.setCache = setCache;
    this.clearCache = clearCache;

    // Others
    this.network = { loginUrl, refreshUrl };
    this.paths = { detailsPath, tokenPath, expirationTimePath };
  }

  login = async params => {
    const { mode = 'normal', username = '', password = '', token } = params;
    if (mode === 'token' && token) {
      this.accessToken = token;
      this.isAuthenticated = true;
      const data = await this.refreshDetails();
      if (!data) {
        this.accessToken = undefined;
        this.isAuthenticated = false;

        return undefined;
      }

      return data;
    }

    const response = await this.networkQuery(this.network.loginUrl, { username, password }, 'post');
    if (response && response.networkSuccess) {
      const { data } = response;
      if (!data.success) {
        return data;
      }

      this.userDetails = this.paths.detailsPath ? get(data, this.paths.detailsPath) : data;
      this.accessToken = get(data, this.paths.tokenPath);
      this.expireAt = get(data, this.paths.expirationTimePath, 0);
      this.isAuthenticated = true;
      this.setExpiration();
      this.setCache({
        access_token: this.accessToken,
        details: this.userDetails,
        expire_at: this.expireAt,
        expire_in: get(data, 'expire_in', 0)
      });

      return data;
    }

    return undefined;
  };

  refreshDetails = async () => {
    if (!this.isAuthenticated || !this.accessToken || !this.network.refreshUrl) {
      return undefined;
    }

    const response = await this.networkQuery(this.network.refreshUrl, {}, 'get', this.accessToken);
    if (response && response.networkSuccess) {
      const { data } = response;
      if (!data) {
        return undefined;
      }

      this.userDetails = this.paths.detailsPath ? get(data, this.paths.detailsPath) : data;
      this.setCache({
        access_token: this.accessToken,
        details: this.userDetails,
        expire_at: this.expireAt,
        expire_in: get(data, 'expire_in', 0)
      });

      return data;
    }

    return undefined;
  };

  logout = () => {
    if (!this.isAuthenticated) {
      return false;
    }

    this.userDetails = undefined;
    this.accessToken = undefined;
    this.expireAt = 0;
    this.isAuthenticated = false;
    if (this.expireHandler) {
      clearTimeout(this.expireHandler);
      this.expireHandler = undefined;
    }

    this.clearCache();

    return true;
  };

  can = permission => {
    if (!this.authData || !this.authData.details) {
      return false;
    }

    return get(this.authData, 'details.permissions', []).include(permission);
  };

  setExpiration = () => {
    if (!this.isAuthenticated) {
      return false;
    }

    const remainingTime = this.expireAt - Math.floor(moment.utc().valueOf() / 1000);
    if (remainingTime <= 0) {
      return false;
    }

    if (this.expireHandler) {
      clearTimeout(this.expireHandler);
    }

    this.expireHandler = setTimeout(() => {
      this.expireHandler = undefined;
      this.logout();
    }, remainingTime * 1000);

    return true;
  };

  // Others

  networkQuery = async (url, params = {}, method = 'get', accessToken = '') => {
    let result;
    try {
      method = method.toLowerCase();
      const headers = {};
      if (accessToken) {
        headers.Authorization = `Bearer ${accessToken}`;
      }

      Object.values(params).forEach(value => {
        if (value instanceof Blob && headers['Content-Type'] !== 'multipart/form-data') {
          headers['Content-Type'] = 'multipart/form-data';

          return;
        }
      });

      const dataOrParams = ['get', 'delete'].includes(method) ? 'params' : 'data';
      const { data: response, status } = await axios.request({ url, method, headers, [dataOrParams]: params });
      result = response;
      if (status === 204 && method === 'delete') {
        result = { networkSuccess: true, data: null };
      }
    } catch (e) {
      console.error(e);
    }

    return { networkSuccess: !!result, data: result };
  };
}

export default BasicProvider;
