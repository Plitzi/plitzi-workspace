import type { RefObject } from 'react';

export type CollaboratorCursorProps = {
  ref: RefObject<HTMLDivElement | null>;
  title?: string;
  color?: string;
  zoom?: number;
};

// Positioned imperatively by CollaboratorArea (see the canvas styles for how it sits on the canvas): a pointer
// moving at 20 samples a second must never go through React state.
const CollaboratorCursor = ({ ref, title = '', color = '#000', zoom = 1 }: CollaboratorCursorProps) => {
  return (
    <div ref={ref} className="builder-collaborator-cursor" style={{ color, scale: 1 / zoom }}>
      <i className="fas fa-mouse-pointer" />
      <div className="cursor-username" style={{ backgroundColor: color }}>
        {title}
      </div>
    </div>
  );
};

export default CollaboratorCursor;
