export const StyleSelectors = {
  SELECTOR_CLASS: 'class',
  SELECTOR_ELEMENT: 'element',
  SELECTOR_ID: 'id',
  SELECTOR_STATE: 'state',
  SELECTOR_PARENT: 'parent'
};

export const StyleParser = (tags, filters = [], includePrefix = true, separator = '') => {
  if (!tags) {
    return '';
  }

  let value = '';
  value = tags
    .filter(tag => filters.length === 0 || filters.includes(tag.type))
    .map(tag => {
      if (!includePrefix) {
        return tag.value;
      }

      switch (tag.type) {
        case StyleSelectors.SELECTOR_CLASS:
          return `.${tag.value}`;
        case StyleSelectors.SELECTOR_ELEMENT:
          return tag.value;
        case StyleSelectors.SELECTOR_ID:
          return `#${tag.value}`;
        case StyleSelectors.SELECTOR_STATE:
          return `:${tag.value}`;
        default:
          return '';
      }
    });

  return value.join(separator);
};

export const processSelector = selector => {
  const result = [];
  Object.keys(selector).forEach(selectorKey => {
    Object.keys(selector[selectorKey]).forEach(key => {
      result.push(`${key}: ${selector[selectorKey][key]};`);
    });
  });

  return result.join('');
};

export const stringToSelector = value => {
  const parser = /([.:#]?)([a-z0-9\-_]+)/gim;
  const values = [];
  const segments = value.split(' ');
  value = segments.pop();
  if (segments.length > 0) {
    segments.forEach(segment => {
      return values.push({ type: StyleSelectors.SELECTOR_PARENT, value: segment });
    });
  }

  let match = parser.exec(value);
  while (match) {
    switch (match[1]) {
      case '.':
        values.push({ type: StyleSelectors.SELECTOR_CLASS, value: match[2] });

        break;

      case '#':
        values.push({ type: StyleSelectors.SELECTOR_ID, value: match[2] });

        break;

      case ':':
        values.push({ type: StyleSelectors.SELECTOR_STATE, value: match[2] });

        break;

      case '':
        values.push({ type: StyleSelectors.SELECTOR_ELEMENT, value: match[2] });

        break;

      default:
    }

    match = parser.exec(value);
  }

  return values;
};


export const selectorToString = (tags, filters = [], includePrefix = true, separator = '') => {
  if (!tags || tags.length === 0) {
    return '';
  }

  let value = '';
  value = tags
    .filter(tag => filters.length === 0 || filters.includes(tag.type))
    .map(tag => {
      if (!includePrefix) {
        return tag.value;
      }

      switch (tag.type) {
        case StyleSelectors.SELECTOR_CLASS:
          return `.${tag.value}`;
        case StyleSelectors.SELECTOR_ELEMENT:
        case StyleSelectors.SELECTOR_PARENT:
          return tag.value;
        case StyleSelectors.SELECTOR_ID:
          return `#${tag.value}`;
        case StyleSelectors.SELECTOR_STATE:
          return `:${tag.value}`;
        default:
          return '';
      }
    });

  return value.join(separator);
};

export const classStringFilter = (value, filters = [], includePrefix = true, separator = '') => {
  value = stringToSelector(value);

  return selectorToString(value, filters, includePrefix, separator);
};
