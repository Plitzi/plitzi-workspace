import lodashCapitalize from 'lodash/capitalize';

import type { DataSourceUtility } from '@plitzi/sdk-shared';

const callback = (source: string) => {
  if (typeof source !== 'string') {
    return source;
  }

  return lodashCapitalize(source);
};

const capitalize: DataSourceUtility = {
  action: 'capitalize',
  title: 'Capitalize',
  type: 'utility',
  params: {},
  preview: { content: '' },
  callback
};

export default capitalize;
