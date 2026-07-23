import { get } from '@plitzi/plitzi-ui/helpers';

import utility from '@plitzi/sdk-shared/dataSource/utility';

import type { BindingTransformer } from '@plitzi/sdk-shared';

const transformerString = (transformers: BindingTransformer[] = []) => {
  const str = transformers.reduce<string[]>((acum, transformer) => {
    const { action, params, enabled = true } = transformer;
    const actionName = get(utility, `${action}.title`, action);
    const label = enabled ? actionName : `${actionName} (disabled)`;
    switch (action) {
      case 'staticValue':
        return [...acum, enabled ? `${actionName} = ${params.value}` : `${actionName} = ${params.value} (disabled)`];

      default:
        return [...acum, label];
    }
  }, []);
  if (str.length) {
    return str.join(' / ');
  }

  return 'None';
};

export default transformerString;
