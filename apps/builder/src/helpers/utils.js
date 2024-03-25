const mongoObjectId = () => {
  const timestamp = ((new Date().getTime() / 1000) | 0).toString(16); // eslint-disable-line

  return (
    timestamp +
    'xxxxxxxxxxxxxxxx'
      .replace(/[x]/g, function () {
        return ((Math.random() * 16) | 0).toString(16); // eslint-disable-line
      })
      .toLowerCase()
  );
};

export const generateID = () => {
  return mongoObjectId();
};

export const isInViewport = el => {
  const rect = el.getBoundingClientRect();
  const { top, left, bottom, right } = rect;
  const { innerHeight, innerWidth } = window;
  const {
    documentElement: { clientHeight, clientWidth }
  } = document;

  return top >= 0 && left >= 0 && bottom <= (innerHeight || clientHeight) && right <= (innerWidth || clientWidth);
};

export const isUrl = str => {
  const regexp = /^(https?:\/\/)?([\da-z.-]+\.[a-z.]{2,6}|[\d.]+)([/:?=&#]{1}[\da-zA-Z. :|;-]+)*[/?]?$/gim;
  if (regexp.test(str)) {
    return true;
  }

  return false;
};

export function ParamsFromURL(query = undefined) {
  query = query || window.location.search;
  const queryString = {};
  if (!query || query.length === 0) {
    return queryString;
  }

  const vars = query.replace('?', '').split('&');
  for (let i = 0; i < vars.length; i++) {
    const stringArr = vars[i].split('=');
    const key = decodeURIComponent(stringArr[0]);
    const value = decodeURIComponent(stringArr[1]);
    // If first entry with this name
    if (typeof queryString[key] === 'undefined') {
      queryString[key] = decodeURIComponent(value);
      // If second entry with this name
    } else if (typeof queryString[key] === 'string') {
      const arr = [queryString[key], decodeURIComponent(value)];
      queryString[key] = arr;
      // If third or later entry with this name
    } else {
      queryString[key].push(decodeURIComponent(value));
    }
  }

  return queryString;
}

export const hexToRGB = (hex, alpha) => {
  if (!hex) {
    return false;
  }

  let r;
  let g;
  let b;
  if (hex.length === 7) {
    [r, g, b] = hex.match(/\w\w/g).map(x => parseInt(x, 16));
  } else if (hex.length === 4) {
    [r, g, b] = hex.match(/\w/g).map(x => parseInt(`${x}${x}`, 16));
  } else {
    return false;
  }

  if (alpha) {
    return `rgba(${r},${g},${b},${alpha})`;
  }

  return `rgb(${r},${g},${b})`;
};

export const getPathsFromObeject = (object, basePath = '', glue = '.', skipArray = false) => {
  if (!object || typeof object !== 'object') {
    return [];
  }

  return Object.keys(object).reduce((acum, key) => {
    key = key.replaceAll(glue, '').replaceAll('.', '');
    const path = `${basePath}${basePath ? glue : ''}${key}`;

    if (typeof object[key] !== 'object') {
      return [...acum, path];
    }

    if (Array.isArray(object[key]) && skipArray) {
      return [...acum, path];
    }

    return [...acum, path, ...getPathsFromObeject(object[key], path, glue, skipArray)];
  }, []);
};

export const delay = ms =>
  new Promise(res => {
    setTimeout(res, ms);
  });
