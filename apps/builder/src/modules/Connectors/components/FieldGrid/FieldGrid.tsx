import type { ReactNode } from 'react';

export type FieldGridProps = {
  children: ReactNode;
};

/**
 * Flows short fields into as many columns as the panel can fit.
 *
 * The Connectors panel renders in the main area, not in a 350px dock, so on a wide monitor a single column of
 * full-width inputs leaves most of the screen empty and stretches every field far past the length of what goes in
 * it. `auto-fill` handles that without breakpoints: one column in a narrow panel, three in a wide one, and nothing
 * to keep in step with the popup's resize handle.
 */
const FieldGrid = ({ children }: FieldGridProps) => {
  return (
    <div className="grid [grid-template-columns:repeat(auto-fill,minmax(190px,1fr))] items-end gap-2">{children}</div>
  );
};

export default FieldGrid;
