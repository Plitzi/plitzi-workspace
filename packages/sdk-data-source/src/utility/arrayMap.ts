// Packages
import get from 'lodash/get';
import set from 'lodash/set';

const callback = (source: string[] | string, params: { keys: string | { from: string; to: string }[] }) => {
  let { keys } = params;
  if (!Array.isArray(source)) {
    return source;
  }

  try {
    if (typeof keys === 'string') {
      keys = JSON.parse(keys) as { from: string; to: string }[];
    }
  } catch {
    return source;
  }

  return source.map(item => {
    const newItem: Record<string, string> = {};
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
