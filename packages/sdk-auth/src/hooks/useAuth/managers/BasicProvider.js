// Packages
import get from 'lodash/get.js';
import moment from 'moment';

class BasicProvider {
  constructor(props = {}) {
    const {
      cache,
      setCache,
      clearCache,
      loginUrl,
      refreshUrl,
      detailsPath = '',
      tokenPath = '',
      expirationTimePath = ''
    } = props;

    // Props
    if (cache) {
      this.userDetails = get(cache, 'details', undefined);
      this.accessToken = get(cache, 'access_token', undefined);
      this.expireAt = get(cache, 'expire_at', 0);
      this.isAuthenticated = !!this.accessToken;
    } else {
      this.reset(false);
    }

    // Cache
    this.setCache = setCache;
    this.clearCache = clearCache;

    // Others
    this.expireHandler = undefined;
    this.network = { loginUrl, refreshUrl };
    this.paths = { detailsPath, tokenPath, expirationTimePath };

    if (this.isAuthenticated) {
      this.refreshDetails()
        .then(data => {
          if (!data || data.errors) {
            this.logout();
          } else {
            this.setExpiration();
          }
        })
        .catch(() => this.logout());
    }
  }

  #loginAsToken = async token => {
    this.accessToken = token;
    this.isAuthenticated = true;
    const data = await this.refreshDetails(false);
    if (!data || data?.errors) {
      return {
        errors: {
          token: 'Invalid token'
        }
      };
    }

    return data;
  };

  #loginAsNormal = async (username, password) => {
    const response = await this.#networkQuery(this.network.loginUrl, { username, password }, 'post');
    const token = get(response, `data.${this.paths.tokenPath}`);
    if (!response || !token) {
      return {
        errors: {
          username: 'Invalid username or password',
          password: 'Invalid username or password'
        }
      };
    }

    return this.#loginAsToken(token);
  };

  login = async params => {
    const { mode = 'normal', username = '', password = '', token } = params;
    let response;
    if (mode === 'token' && token) {
      response = await this.#loginAsToken(token);
    } else if (mode === 'normal' && username && password) {
      response = await this.#loginAsNormal(username, password);
    }

    if (response.errors) {
      this.reset(false);

      return response;
    }

    this.setExpiration();
    this.syncCache();

    return {
      success: this.isAuthenticated,
      access_token: this.accessToken,
      expires_at: this.expireAt,
      details: this.userDetails
    };
  };

  refreshDetails = async (invalidateCache = true) => {
    if (!this.isAuthenticated || !this.accessToken || !this.network.refreshUrl) {
      return { errors: 'Invalid request' };
    }

    const response = await this.#networkQuery(this.network.refreshUrl, {}, 'get', this.accessToken);
    if (!response) {
      return { errors: 'Failed fetching user details' };
    }

    if (response.status === 500) {
      return { skip: true };
    }

    this.userDetails = this.paths.detailsPath ? get(response, `data.${this.paths.detailsPath}`) : get(response, 'data');
    if (!this.userDetails) {
      return { errors: 'Invalid user details' };
    }

    this.expireAt = get(response, this.paths.expirationTimePath, 0);
    if (invalidateCache) {
      this.syncCache();
    }

    return {
      success: this.isAuthenticated,
      access_token: this.accessToken,
      expires_at: this.expireAt,
      details: this.userDetails
    };
  };

  logout = () => {
    if (!this.isAuthenticated) {
      return false;
    }

    this.reset();

    return true;
  };

  can = permission => {
    if (!this.authData || !this.authData.details) {
      return false;
    }

    return get(this.authData, 'details.permissions', []).include(permission);
  };

  // Others

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

  syncCache = () => {
    this.setCache({
      access_token: this.accessToken,
      details: this.userDetails,
      expire_at: this.expireAt
    });
  };

  reset = (invalidateCache = true) => {
    if (invalidateCache) {
      this.clearCache();
    }

    this.userDetails = undefined;
    this.accessToken = undefined;
    this.expireAt = 0;
    this.isAuthenticated = false;
    if (this.expireHandler) {
      clearTimeout(this.expireHandler);
      this.expireHandler = undefined;
    }
  };

  #networkQuery = async (url, params = {}, method = 'get', accessToken = '') => {
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

      const formData = new FormData();
      Object.entries(params).forEach(([key, value]) => {
        formData.append(key, value);
      });

      const fetchOptions = { method, headers, body: formData };
      if (method === 'get') {
        delete fetchOptions.body;
      }

      const response = await fetch(url, fetchOptions);
      result = { status: response.status, data: await response.json() };
      if (response.status === 204 && method === 'delete') {
        result = { status: response.status, data: true };
      } else if (response.status >= 400) {
        result = { status: response.status, data: undefined };
      }
    } catch (e) {
      result = { status: 500, data: undefined };
      console.error(e);
    }

    return result;
  };
}

export default BasicProvider;
