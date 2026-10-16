import type { CSSProperties } from 'react';

/** The pattern a transparent color is drawn over, so `transparent` and `rgba(…, 0.2)` read as what they are. */
export const CHECKERBOARD: CSSProperties = {
  backgroundImage:
    'linear-gradient(45deg, #cfcfd8 25%, transparent 25%), linear-gradient(-45deg, #cfcfd8 25%, transparent 25%), ' +
    'linear-gradient(45deg, transparent 75%, #cfcfd8 75%), linear-gradient(-45deg, transparent 75%, #cfcfd8 75%)',
  backgroundColor: '#ffffff',
  backgroundSize: '8px 8px',
  backgroundPosition: '0 0, 0 4px, 4px -4px, -4px 0'
};
