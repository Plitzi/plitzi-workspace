// Packages
import lodashCapitalize from 'lodash/capitalize';

const callback = source => {
  if (typeof source !== 'string') {
    return source;
  }

  return lodashCapitalize(source);
};

const capitalize = {
  action: 'capitalize',
  title: 'Capitalize',
  type: 'utility',
  params: {},
  preview: { content: '' },
  callback
};

export default capitalize;
