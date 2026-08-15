import { RootElement, useRscData } from '@plitzi/plitzi-sdk';

import { card, label, row, title } from './styles';

/** `runtime: 'server'` — rendered on the server and never mounted in the browser. No effect here ever runs, which
 *  is what makes it safe to read things the browser must not see.
 *
 *  `useRscData` returns this element's own slice of what `getRscData` produced, keyed by the element's schema id. */

type ServerData = {
  message: string;
  renderedAt: string;
  nodeVersion: string;
  authenticated: boolean;
};

const ServerInfo = () => {
  const { loaded, elementData } = useRscData<ServerData | null>();

  if (!loaded || !elementData) {
    return (
      <RootElement style={card('server')}>
        <div style={title('server')}>🖥 Server Info — runtime: &quot;server&quot;</div>
        <span style={{ color: '#9ca3af' }}>No slice for this element yet.</span>
      </RootElement>
    );
  }

  return (
    <RootElement style={card('server')}>
      <div style={title('server')}>🖥 Server Info — runtime: &quot;server&quot;</div>
      <div style={row}>
        <span style={label}>Message</span>
        <span>{elementData.message}</span>
      </div>
      <div style={row}>
        <span style={label}>Rendered at</span>
        <span>{elementData.renderedAt}</span>
      </div>
      <div style={row}>
        <span style={label}>Node.js</span>
        <span>{elementData.nodeVersion}</span>
      </div>
      <div style={row}>
        <span style={label}>Signed in</span>
        <span>{elementData.authenticated ? 'yes' : 'no'}</span>
      </div>
    </RootElement>
  );
};

export default ServerInfo;
