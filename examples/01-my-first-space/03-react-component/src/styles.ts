import type { CSSProperties } from 'react';

/** Inline styles so the example carries no CSS tooling — it is about composition, not about styling. */
const styles = {
  page: { fontFamily: 'system-ui, sans-serif', height: '100vh', display: 'flex', flexDirection: 'column' },
  header: { display: 'flex', alignItems: 'center', gap: 12, padding: '10px 16px', borderBottom: '1px solid #e2e2e2' },
  spacer: { flex: 1 },
  control: { fontSize: 14 },
  main: { flex: 1, display: 'flex', minHeight: 0 },
  aside: { width: 220, padding: 16, borderRight: '1px solid #e2e2e2', background: '#fafafa' },
  asideText: { fontSize: 14, color: '#555', lineHeight: 1.5 },
  canvas: { flex: 1, overflow: 'auto' }
} satisfies Record<string, CSSProperties>;

export default styles;
