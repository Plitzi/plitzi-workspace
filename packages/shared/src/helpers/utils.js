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
