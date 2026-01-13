import type { RefObject } from 'react';

export type BuilderCollaboratorCursorProps = {
  ref: RefObject<HTMLDivElement | null>;
  title?: string;
  color?: string;
  zoom?: number;
};

const BuilderCollaboratorCursor = ({ ref, title = '', color = '#000', zoom = 1 }: BuilderCollaboratorCursorProps) => {
  return (
    <div ref={ref} className="builder-collaborator-cursor" style={{ color, scale: 1 / zoom }}>
      <i className="fas fa-mouse-pointer" />
      <div className="cursor-username" style={{ backgroundColor: color }}>
        {title}
      </div>
    </div>
  );
};

export default BuilderCollaboratorCursor;
