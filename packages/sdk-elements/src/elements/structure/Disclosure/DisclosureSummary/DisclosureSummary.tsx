import clsx from 'clsx';

import withElement from '../../../../Element/hocs/withElement';
import useElement from '../../../../Element/hooks/useElement';
import RootElement from '../../../../Element/RootElement';

import type { ReactNode, RefObject } from 'react';

export type DisclosureSummaryProps = {
  ref?: RefObject<HTMLElement | null>;
  className?: string;
  children?: ReactNode;
  /**
   * The sign at its end that turns as the disclosure opens. Off, it draws none — for a sign of its own: an icon inside
   * it, turned by the parent's `expanded` state.
   */
  marker?: boolean;
  /**
   * Its name for a screen reader and a browser agent when its words do not say it — a menu's burger, an icon alone
   * (`aria-label` on the `<summary>`). Words inside it name it already.
   */
  label?: string;
};

/** What is pressed to open a disclosure and close it: its `<summary>`, whose text is the control's name. */
const DisclosureSummary = ({ ref, className = '', children, marker = true, label = '' }: DisclosureSummaryProps) => {
  const {
    definition: { styleSelectors }
  } = useElement();

  return (
    <RootElement
      tag="summary"
      ref={ref}
      className={clsx('plitzi-component__disclosure-summary', className)}
      {...(label ? { 'aria-label': label } : {})}
    >
      {children}
      {marker && (
        <span className={clsx('plitzi-component__disclosure-marker', styleSelectors.marker)} aria-hidden="true" />
      )}
    </RootElement>
  );
};

export default withElement(DisclosureSummary);

export { DisclosureSummary };
