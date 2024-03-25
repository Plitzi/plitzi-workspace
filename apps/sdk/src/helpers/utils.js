export const delay = ms =>
  new Promise(res => {
    setTimeout(res, ms);
  });

export const getRandomInteger = (min, max) => Math.random() * (max - min) + min;

export function ParamsFromURL(query = undefined) {
  if (typeof window !== 'undefined') {
    query = query || window.location.search;
  }

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

export const compose = (...funcs) => {
  if (funcs.length === 0) {
    // infer the argument type so it is usable in inference down the line
    return arg => arg;
  }

  if (funcs.length === 1) {
    return funcs[0];
  }

  return funcs.reduce(
    (a, b) =>
      (...args) =>
        a(b(...args))
  );
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

export const makeId = (length, includeMayus = true, includeNumbers = true) => {
  let result = '';
  let characters = 'abcdefghijklmnopqrstuvwxyz';
  if (includeMayus) {
    characters = `ABCDEFGHIJKLMNOPQRSTUVWXYZ${characters}`;
  }

  if (includeNumbers) {
    characters = `${characters}0123456789`;
  }

  const charactersLength = characters.length;
  for (let i = 0; i < length; i++) {
    result += characters.charAt(Math.floor(Math.random() * charactersLength));
  }

  return result;
};
