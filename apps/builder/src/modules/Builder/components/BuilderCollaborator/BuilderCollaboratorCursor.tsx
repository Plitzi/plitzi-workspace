import type { RefObject } from 'react';

export type BuilderCollaboratorCursorProps = {
  ref: RefObject<HTMLDivElement | null>;
  title?: string;
  color?: string;
  scale?: number;
};

const BuilderCollaboratorCursor = ({ ref, title = '', color = '#000', scale = 1 }: BuilderCollaboratorCursorProps) => {
  return (
    <div ref={ref} className="builder-collaborator-cursor" style={{ color, fontSize: `${16 * (1 / scale)}px` }}>
      <i className="fas fa-mouse-pointer" />
      <div className="cursor-username" style={{ backgroundColor: color }}>
        {title}
      </div>
    </div>
  );
};

export default BuilderCollaboratorCursor;
