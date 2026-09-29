import type { CSSProperties } from 'react';

/** Plain inline styles: these three components are here to make the render VISIBLE, and a styling system of their
 *  own would only be one more thing to read past. */

type Tone = 'server' | 'client' | 'shared';

const palette: Record<Tone, { background: string; border: string; title: string }> = {
  server: { background: '#f0fdf4', border: '#86efac', title: '#15803d' },
  client: { background: '#eff6ff', border: '#93c5fd', title: '#1d4ed8' },
  shared: { background: '#faf5ff', border: '#c4b5fd', title: '#7e22ce' }
};

export const card = (tone: Tone): CSSProperties => ({
  padding: '1.25rem 1.5rem',
  borderRadius: '10px',
  background: palette[tone].background,
  border: `1px solid ${palette[tone].border}`,
  fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
  fontSize: '0.82rem',
  lineHeight: 1.65,
  marginBottom: '0.5rem'
});

export const title = (tone: Tone): CSSProperties => ({
  fontWeight: 700,
  color: palette[tone].title,
  marginBottom: '0.75rem',
  fontSize: '0.88rem'
});

export const row: CSSProperties = { display: 'flex', gap: '0.5rem', marginBottom: '0.15rem' };

export const label: CSSProperties = { color: '#6b7280', minWidth: '130px', flexShrink: 0 };
