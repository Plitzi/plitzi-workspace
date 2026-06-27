import { capitalize as capitalizeHelper } from '@plitzi/plitzi-ui/helpers';

import type { DataSourceUtility } from '../../types';

const callback = (source: string) => {
  if (typeof source !== 'string') {
    return source;
  }

  return capitalizeHelper(source);
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
