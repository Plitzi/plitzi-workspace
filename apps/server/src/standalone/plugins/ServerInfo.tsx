/**
 * RSC example — runtime: 'server'
 *
 * Rendered only on the server. RootElement adds data-plitzi-id to its root
 * DOM node so ServerStaticShell can locate and freeze it during client hydration.
 * The plugin is never mounted in the browser — no useEffect ever runs.
 */
import { RootElement, useRscData } from '@plitzi/plitzi-sdk';
import { useEffect } from 'react';

import { titleStyle, row, label, card } from './styles';

type ServerData = {
  message: string;
  renderedAt: string;
  nodeVersion: string;
  uptime: number;
};

const ServerInfo = () => {
  // console.log('server', props);
  const { serverData, elementData } = useRscData<ServerData | null>();

  useEffect(() => {
    console.log('Should not be triggered');
  }, []);

  if (!serverData) {
    return (
      <RootElement style={card('gray')}>
        <div style={titleStyle('gray')}>🖥 Server Info — runtime: &quot;server&quot;</div>
        <span style={{ color: '#9ca3af' }}>⏳ Fetching from /_rsc…</span>
      </RootElement>
    );
  }

  if (!elementData) {
    return (
      <RootElement style={card('red')}>
        <div style={titleStyle('red')}>🖥 Server Info — runtime: &quot;server&quot;</div>
        <span>❌ No data returned</span>
      </RootElement>
    );
  }

  return (
    <RootElement style={card('green')}>
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
    </RootElement>
  );
};

export default ServerInfo;
