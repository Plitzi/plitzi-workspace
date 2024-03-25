export function getDisplayName(WrappedComponent) {
  return WrappedComponent.displayName || WrappedComponent.name || 'Component';
}

const emptyObject = {};
Object.freeze(emptyObject);

export { emptyObject };

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
