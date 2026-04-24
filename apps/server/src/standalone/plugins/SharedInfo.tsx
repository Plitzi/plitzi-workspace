/**
 * RSC example — runtime: 'shared' (default)
 *
 * Renders on both server (SSR) and client. The component itself detects
 * which environment it's in so you can observe the SSR → hydration transition.
 * SSR renders with isClient=false; after hydration useEffect flips it to true.
 */
import { useState, useEffect } from 'react';

import { card, titleStyle, row, label } from './styles';

const SharedInfo = () => {
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
  }, []);

  const color = isClient ? 'purple' : 'gray';
  const phase = isClient ? 'Browser — hydrated ✅' : 'Server — SSR ⚡';

  return (
    <div style={card(color)}>
      <div style={titleStyle(color)}>🔄 Shared Info — runtime: &quot;shared&quot;</div>
      <div style={row}>
        <span style={label}>Rendered in</span>
        <span>{phase}</span>
      </div>
      <div style={row}>
        <span style={label}>window</span>
        <span>{typeof window !== 'undefined' ? 'defined' : 'undefined'}</span>
      </div>
      <div style={row}>
        <span style={label}>document</span>
        <span>{typeof document !== 'undefined' ? 'defined' : 'undefined'}</span>
      </div>
      <div style={row}>
        <span style={label}>React state</span>
        <span>{isClient ? 'useEffect fired' : 'SSR (no effects)'}</span>
      </div>
    </div>
  );
};

export default SharedInfo;
