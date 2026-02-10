import type { InternalPropsSTG2 } from '@plitzi/sdk-shared';

const defaultInternalProps: InternalPropsSTG2 = {
  id: '',
  rootId: '',
  attributes: {},
  definition: { rootId: '', label: '', type: '', styleSelectors: {} },
  elementState: {},
  setElementState: () => false
};

export default defaultInternalProps;
