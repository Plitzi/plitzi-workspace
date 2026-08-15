import { RootElement } from '@plitzi/plitzi-sdk';
import { useEffect, useState } from 'react';

import { card, label, row, title } from './styles';

/** `runtime: 'client'` — skipped entirely during SSR and rendered only once the page is in a browser. There is no
 *  server slice to read: this is where anything that needs a real `window` goes. */

type BrowserInfo = {
  viewport: string;
  language: string;
  timezone: string;
};

const ClientInfo = () => {
  const [info, setInfo] = useState<BrowserInfo | null>(null);

  useEffect(() => {
    setInfo({
      viewport: `${window.innerWidth} × ${window.innerHeight}`,
      language: navigator.language,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone
    });
  }, []);

  return (
    <RootElement style={card('client')}>
      <div style={title('client')}>🌐 Client Info — runtime: &quot;client&quot;</div>

      {!info && <span style={{ color: '#9ca3af' }}>Reading browser APIs…</span>}

      {info && (
        <>
          <div style={row}>
            <span style={label}>Viewport</span>
            <span>{info.viewport}</span>
          </div>
          <div style={row}>
            <span style={label}>Language</span>
            <span>{info.language}</span>
          </div>
          <div style={row}>
            <span style={label}>Timezone</span>
            <span>{info.timezone}</span>
          </div>
        </>
      )}
    </RootElement>
  );
};

export default ClientInfo;
