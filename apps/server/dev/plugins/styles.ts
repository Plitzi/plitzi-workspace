import type { CSSProperties } from 'react';

export const card = (color: 'green' | 'blue' | 'purple' | 'gray' | 'red'): CSSProperties => {
  const palette = {
    green: { bg: '#f0fdf4', border: '#86efac', title: '#15803d' },
    blue: { bg: '#eff6ff', border: '#93c5fd', title: '#1d4ed8' },
    purple: { bg: '#faf5ff', border: '#c4b5fd', title: '#7e22ce' },
    gray: { bg: '#f9fafb', border: '#e5e7eb', title: '#374151' },
    red: { bg: '#fef2f2', border: '#fca5a5', title: '#dc2626' }
  };
  const p = palette[color];
  return {
    padding: '1.25rem 1.5rem',
    borderRadius: '10px',
    background: p.bg,
    border: `1px solid ${p.border}`,
    fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
    fontSize: '0.82rem',
    lineHeight: 1.65,
    marginBottom: '0.5rem'
  };
};

export const titleStyle = (color: 'green' | 'blue' | 'purple' | 'gray' | 'red'): CSSProperties => {
  const colors = { green: '#15803d', blue: '#1d4ed8', purple: '#7e22ce', gray: '#374151', red: '#dc2626' };
  return { fontWeight: 700, color: colors[color], marginBottom: '0.75rem', fontSize: '0.88rem' };
};

export const row: CSSProperties = { display: 'flex', gap: '0.5rem', marginBottom: '0.15rem' };
export const label: CSSProperties = { color: '#6b7280', minWidth: '130px', flexShrink: 0 };
