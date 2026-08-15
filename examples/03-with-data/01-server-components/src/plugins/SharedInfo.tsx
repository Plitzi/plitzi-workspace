import { RootElement, useRscData } from '@plitzi/plitzi-sdk';
import { useEffect, useState } from 'react';

import { card, label, row, title } from './styles';

/** `runtime: 'shared'` (the default) — rendered on the server AND mounted in the browser. The server slice is on
 *  screen from the first paint because it ships inlined in the page; the browser half appears after hydration. */

type SharedServerData = {
  serverTimestamp: string;
  uptimeSeconds: number;
};

const SharedInfo = () => {
  const { elementData } = useRscData<SharedServerData | null>();
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setHydrated(true);
  }, []);

  return (
    <RootElement style={card('shared')}>
      <div style={title('shared')}>🔄 Shared Info — runtime: &quot;shared&quot; — {hydrated ? 'hydrated' : 'SSR'}</div>

      {elementData && (
        <>
          <div style={row}>
            <span style={label}>Server time</span>
            <span>{elementData.serverTimestamp}</span>
          </div>
          <div style={row}>
            <span style={label}>Uptime</span>
            <span>{elementData.uptimeSeconds}s</span>
          </div>
        </>
      )}
    </RootElement>
  );
};

export default SharedInfo;
