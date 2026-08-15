import { useRscData } from '@plitzi/plitzi-sdk';

import { Probe } from './probe';

/** `runtime: 'shared'` — rendered on the server AND mounted in the browser. */
const SharedProbe = () => {
  const { elementData } = useRscData<unknown>();

  return <Probe runtime="shared" data={elementData} />;
};

export default SharedProbe;
