// Packages
import get from 'lodash/get.js';

// Types
import type { FC } from 'react';

export const isTestMode = () => typeof process !== 'undefined' && process.env.NODE_ENV === 'test';

export function getDisplayName(WrappedComponent?: FC) {
  if (!WrappedComponent) {
    return 'Component';
  }

  return WrappedComponent.displayName || WrappedComponent.name || 'Component';
}

const emptyObject = {};
Object.freeze(emptyObject);

export { emptyObject };

const mongoObjectId = () => {
  const timestamp = ((new Date().getTime() / 1000) | 0).toString(16);

  return (
    timestamp +
    'xxxxxxxxxxxxxxxx'
      .replace(/[x]/g, function () {
        return ((Math.random() * 16) | 0).toString(16);
      })
      .toLowerCase()
  );
};

export const generateID = (prevId: string = '') => {
  if (!isTestMode()) {
    return mongoObjectId();
  }

  if (!prevId) {
    return 'id_000000';
  }

  return `id_${prevId.substring(prevId.length - 6)}`;
};

export const getPathsFromObeject = (
  object?: { [key: string]: unknown },
  basePath = '',
  glue = '.',
  skipArray = false
) => {
  if (!object || typeof object !== 'object') {
    return [];
  }

  return Object.keys(object).reduce<string[]>((acum, key): string[] => {
    key = key.replaceAll(glue, '').replaceAll('.', '');
    const path = `${basePath}${basePath ? glue : ''}${key}`;

    if (typeof object[key] !== 'object') {
      return [...acum, path];
    }

    if (Array.isArray(object[key]) && skipArray) {
      return [...acum, path];
    }

    return [...acum, path, ...getPathsFromObeject(object[key] as { [key: string]: unknown }, path, glue, skipArray)];
  }, []);
};

export const makeId = (length: number, includeMayus = true, includeNumbers = true) => {
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

export const getKeyDecoded = (webKey?: string, asWebId = false) => {
  if (!webKey) {
    return 0;
  }

  let payload: unknown = {};
  try {
    if (typeof window !== 'undefined') {
      payload = JSON.parse(window.atob(webKey.split('.')[1]).toString());
    } else {
      payload = JSON.parse(Buffer.from(webKey.split('.')[1], 'base64').toString());
    }
  } catch {
    return 0;
  }

  if (asWebId) {
    return get(payload, 'data.spaceId', 0) as number;
  }

  return payload;
};

export function ParamsFromURL(query?: string) {
  if (!query && typeof window !== 'undefined') {
    query = window.location.search;
  }

  const queryString: { [key: string]: string | string[] } = {};
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

export const delay = (ms: number) =>
  new Promise(res => {
    setTimeout(res, ms);
  });
