/**
 * RSC example — runtime: 'server'
 *
 * This element is skipped during SSR client-side re-renders (useInternalItems
 * runtime filter). On mount it fetches /_rsc and reads its own slice via the
 * element id prop (serverData[id]).
 */
import { useRscData } from '@plitzi/plitzi-sdk';
import { useEffect, useState } from 'react';

import { card, titleStyle, row, label } from './styles';

type ServerData = {
  message: string;
  renderedAt: string;
  nodeVersion: string;
  uptime: number;
};

const ServerInfo = () => {
  const { serverData, elementData } = useRscData<ServerData | null>();
  const [message, setMessage] = useState('');

  useEffect(() => {
    setMessage('Server Component Hydrated, WRONG');
  }, []);

  if (!serverData) {
    return (
      <div style={card('gray')}>
        <div style={titleStyle('gray')}>🖥 Server Info — runtime: &quot;server&quot;</div>
        <span style={{ color: '#9ca3af' }}>⏳ Fetching from /_rsc…</span>
      </div>
    );
  }

  if (!elementData) {
    return (
      <div style={card('red')}>
        <div style={titleStyle('red')}>🖥 Server Info — runtime: &quot;server&quot;</div>
        <span>❌ No data returned</span>
      </div>
    );
  }

  return (
    <div style={card('green')}>
      <div style={titleStyle('green')}>🖥 Server Info — runtime: &quot;server&quot;</div>
      <div style={row}>
        <span style={label}>Message</span>
        <span>{elementData.message}</span>
      </div>
      <div style={row}>
        <span style={label}>Server time</span>
        <span>{elementData.renderedAt}</span>
      </div>
      <div style={row}>
        <span style={label}>Node.js</span>
        <span>{elementData.nodeVersion}</span>
      </div>
      <div style={row}>
        <span style={label}>Uptime</span>
        <span>{elementData.uptime}s</span>
      </div>
      <div style={row}>
        <span style={label}>Client - Message</span>
        <span>{message ? message : '-'}</span>
      </div>
    </div>
  );
};

export default ServerInfo;
