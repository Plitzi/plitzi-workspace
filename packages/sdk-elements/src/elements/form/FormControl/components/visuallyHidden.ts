import type { CSSProperties } from 'react';

/**
 * Out of sight and still read: the label keeps naming its field for screen readers and browser agents. Inline, so no
 * class the space puts on the label slot can bring it back into view.
 */
export const VISUALLY_HIDDEN: CSSProperties = {
  position: 'absolute',
  width: '1px',
  height: '1px',
  padding: 0,
  margin: '-1px',
  overflow: 'hidden',
  clipPath: 'inset(50%)',
  whiteSpace: 'nowrap',
  border: 0
};
