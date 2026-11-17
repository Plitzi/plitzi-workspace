import type { ReactNode } from 'react';

export type SheetFrameProps = {
  children: ReactNode;
  /** The view's actions: kept at the sheet's bottom edge, always in reach, while what is above them scrolls. */
  footer?: ReactNode;
};

/** A view of the publish sheet: its content scrolling the sheet's height, its actions fixed under it. */
const SheetFrame = ({ children, footer }: SheetFrameProps) => (
  <div className="flex min-h-0 grow flex-col">
    <div className="flex min-h-0 grow flex-col gap-5 overflow-y-auto px-5 py-4">{children}</div>
    {footer && <div className="border-ui-line bg-ui-overlay shrink-0 border-t px-5 py-3">{footer}</div>}
  </div>
);

export default SheetFrame;
