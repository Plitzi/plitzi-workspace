// Packages
import get from 'lodash/get';
import set from 'lodash/set';

const callback = (source, params) => {
  let { keys } = params;
  if (!Array.isArray(source)) {
    return source;
  }

  try {
    keys = JSON.parse(keys);
  } catch (err) {
    return source;
  }

  return source.map(item => {
    const newItem = {};

    keys.forEach(key => {
      if (typeof key === 'object' && key.from && key.to) {
        set(newItem, key.to, get(item, key.from, ''));
      }
    });

    return newItem;
  });
};

const arrayMap = {
  action: 'arrayMap',
  title: 'Array Map',
  type: 'utility',
  params: {
    keys: { defaultValue: '[{"from": "", "to": ""}]', type: 'textarea' }
  },
  preview: { sourceParsed: '' },
  callback
};

export default arrayMap;
