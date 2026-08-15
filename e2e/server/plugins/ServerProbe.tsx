import { useRscData } from '@plitzi/plitzi-sdk';

import { Probe } from './probe';

/** `runtime: 'server'` — rendered on the server, never mounted in the browser. */
const ServerProbe = () => {
  const { elementData } = useRscData<unknown>();

  return <Probe runtime="server" data={elementData} />;
};

export default ServerProbe;
