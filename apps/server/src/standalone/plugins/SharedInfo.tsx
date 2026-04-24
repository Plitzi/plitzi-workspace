/**
 * RSC example — runtime: 'shared' (default)
 *
 * Renders on both server (SSR) and client. Shows server data from the RSC
 * endpoint (available immediately because it's inlined in the SSR page), then
 * adds client-side data after the first useEffect fires post-hydration.
 */
import { useRscData } from '@plitzi/plitzi-sdk';
import { useState, useEffect } from 'react';

import { card, titleStyle, row, label } from './styles';

type SharedServerData = {
  serverTimestamp: string;
  nodeVersion: string;
};

type ClientData = {
  viewport: string;
  language: string;
  timezone: string;
};

const SharedInfo = () => {
  const { elementData } = useRscData<SharedServerData | null>();
  const [clientData, setClientData] = useState<ClientData | null>(null);

  useEffect(() => {
    setClientData({
      viewport: `${window.innerWidth} × ${window.innerHeight}`,
      language: navigator.language,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone
    });
  }, []);

  const isClient = !!clientData;
  const color = isClient ? 'purple' : 'gray';
  const phase = isClient ? 'hydrated ✅' : 'SSR ⚡';

  return (
    <div style={card(color)}>
      <div style={titleStyle(color)}>🔄 Shared Info — runtime: &quot;shared&quot; — {phase}</div>

      {elementData && (
        <>
          <div style={row}>
            <span style={label}>Server time</span>
            <span>{elementData.serverTimestamp}</span>
          </div>
          <div style={row}>
            <span style={label}>Node.js</span>
            <span>{elementData.nodeVersion}</span>
          </div>
        </>
      )}

      {clientData && (
        <>
          <div style={row}>
            <span style={label}>Viewport</span>
            <span>{clientData.viewport}</span>
          </div>
          <div style={row}>
            <span style={label}>Language</span>
            <span>{clientData.language}</span>
          </div>
          <div style={row}>
            <span style={label}>Timezone</span>
            <span>{clientData.timezone}</span>
          </div>
        </>
      )}
    </div>
  );
};

export default SharedInfo;
