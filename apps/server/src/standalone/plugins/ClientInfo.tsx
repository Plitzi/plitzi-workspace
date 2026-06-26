/**
 * RSC example — runtime: 'client'
 *
 * This element is completely skipped during SSR (useInternalItems filters it
 * out when typeof window === 'undefined'). It only renders in the browser.
 * Use it for anything that must access browser APIs.
 */
import { RootElement } from '@plitzi/plitzi-sdk';
import { useState, useEffect } from 'react';

import { card, titleStyle, row, label } from './styles';

type BrowserInfo = {
  userAgent: string;
  language: string;
  screen: string;
  viewport: string;
  cookiesEnabled: boolean;
};

const ClientInfo = () => {
  const [info, setInfo] = useState<BrowserInfo | null>(null);

  useEffect(() => {
    setInfo({
      userAgent: navigator.userAgent.length > 80 ? navigator.userAgent.slice(0, 77) + '…' : navigator.userAgent,
      language: navigator.language,
      screen: `${screen.width} × ${screen.height}`,
      viewport: `${window.innerWidth} × ${window.innerHeight}`,
      cookiesEnabled: navigator.cookieEnabled
    });
  }, []);

  if (!info) {
    return (
      <RootElement style={card('blue')}>
        <div style={titleStyle('blue')}>🌐 Client Info — runtime: &quot;client&quot;</div>
        <span style={{ color: '#9ca3af' }}>⏳ Reading browser APIs…</span>
      </RootElement>
    );
  }

  return (
    <RootElement style={card('blue')}>
      <div style={titleStyle('blue')}>🌐 Client Info — runtime: &quot;client&quot;</div>
      <div style={row}>
        <span style={label}>User Agent</span>
        <span title={navigator.userAgent}>{info.userAgent}</span>
      </div>
      <div style={row}>
        <span style={label}>Language</span>
        <span>{info.language}</span>
      </div>
      <div style={row}>
        <span style={label}>Screen</span>
        <span>{info.screen}</span>
      </div>
      <div style={row}>
        <span style={label}>Viewport</span>
        <span>{info.viewport}</span>
      </div>
      <div style={row}>
        <span style={label}>Cookies</span>
        <span>{info.cookiesEnabled ? 'enabled ✅' : 'disabled ❌'}</span>
      </div>
    </RootElement>
  );
};

export default ClientInfo;
