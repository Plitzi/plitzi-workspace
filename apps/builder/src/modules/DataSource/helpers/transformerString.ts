/* eslint-disable @typescript-eslint/no-explicit-any */

import { get } from '@plitzi/plitzi-ui/helpers';

import utility from '@plitzi/sdk-elements/dataSource/utility';

const transformerString = (
  transformers: {
    type: 'unknown' | 'utility';
    action: string;
    params: Record<string, any>;
  }[] = []
) => {
  const str = transformers.reduce<string[]>((acum, transformer) => {
    const { action, params } = transformer;
    const actionName = get(utility, `${action}.title`, action);
    switch (action) {
      case 'staticValue':
        return [...acum, `${actionName} = ${params.value}`];

      default:
        return [...acum, actionName];
    }
  }, []);
  if (str.length) {
    return str.join(' / ');
  }

  return 'None';
};

export default transformerString;
